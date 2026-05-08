"""Admin endpoints for question management, CSV/Excel upload, and Claude translation."""
import csv
import io
import logging
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.api.v1.deps import get_current_superuser
from app.models.user import User
from app.models.question import Question, QuestionTier, TranslationStatus
from app.models.market import Market, MarketStatus
from app.schemas.question import QuestionResponse

logger = logging.getLogger(__name__)

router = APIRouter()

TIER_OPTION_COUNT = {
    QuestionTier.FREE: 2,
    QuestionTier.EASY: 2,
    QuestionTier.MEDIUM: 2,
    QuestionTier.HARD: 4,
}


async def _translate_question(question: Question) -> None:
    """Translate a question from Mongolian to EN/RU/HI using Claude API."""
    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — skipping translation")
        question.translation_status = TranslationStatus.FAILED
        return

    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        options_str = "\n".join(f"{i+1}. {opt}" for i, opt in enumerate(question.options_mn))
        prompt = f"""Translate the following quiz question and its answer options from Mongolian to English, Russian, and Hindi.

Question: {question.question_mn}

Answer options:
{options_str}

Respond in this exact JSON format (no markdown, just raw JSON):
{{
  "en": {{
    "question": "...",
    "options": ["...", "...", ...]
  }},
  "ru": {{
    "question": "...",
    "options": ["...", "...", ...]
  }},
  "hi": {{
    "question": "...",
    "options": ["...", "...", ...]
  }}
}}

Rules:
- Keep option count the same as input
- Preserve the meaning exactly
- Keep answer options short (under 60 chars each)
- The question should be natural in the target language"""

        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        text = message.content[0].text.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        data = json.loads(text)

        question.question_en = data["en"]["question"]
        question.options_en = data["en"]["options"]
        question.question_ru = data["ru"]["question"]
        question.options_ru = data["ru"]["options"]
        question.question_hi = data["hi"]["question"]
        question.options_hi = data["hi"]["options"]
        question.translation_status = TranslationStatus.DONE

    except Exception as exc:
        logger.error("Translation failed for question %s: %s", question.id, exc)
        question.translation_status = TranslationStatus.FAILED


def _parse_csv(content: bytes) -> list[dict]:
    """Parse CSV file. Expected columns: tier,question,option1,option2[,option3,option4],correct"""
    text = content.decode("utf-8-sig").strip()
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for i, row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in row.items()}
        rows.append({"row": i, **row})
    return rows


def _parse_excel(content: bytes) -> list[dict]:
    """Parse Excel file with openpyxl."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip().lower() for h in rows[0]]
    result = []
    for i, row in enumerate(rows[1:], start=2):
        result.append({"row": i, **dict(zip(headers, [str(v).strip() if v is not None else "" for v in row]))})
    return result


def _parse_row(raw: dict) -> dict | str:
    """Return parsed question dict or error string."""
    tier_str = raw.get("tier", "").lower()
    if tier_str not in QuestionTier._value2member_map_:
        return f"Row {raw['row']}: invalid tier '{tier_str}'"

    tier = QuestionTier(tier_str)
    expected_count = TIER_OPTION_COUNT[tier]

    question_mn = raw.get("question", "").strip()
    if not question_mn:
        return f"Row {raw['row']}: empty question"

    options = []
    for idx in range(1, expected_count + 1):
        opt = raw.get(f"option{idx}", "").strip()
        if not opt:
            return f"Row {raw['row']}: missing option{idx}"
        options.append(opt)

    correct_raw = raw.get("correct", "").strip()
    if not correct_raw.isdigit():
        return f"Row {raw['row']}: 'correct' must be a number (1-based)"
    correct_idx = int(correct_raw) - 1
    if not (0 <= correct_idx < expected_count):
        return f"Row {raw['row']}: correct option index out of range"

    return {"tier": tier, "question_mn": question_mn, "options_mn": options, "correct_option_idx": correct_idx}


@router.get("/", response_model=List[QuestionResponse])
async def list_questions(
    tier: QuestionTier | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    query = select(Question)
    if tier:
        query = query.where(Question.tier == tier)
    query = query.order_by(Question.tier, Question.order_idx).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/upload", status_code=201)
async def upload_questions(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Upload CSV or Excel file with questions. Auto-translates via Claude."""
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        raw_rows = _parse_excel(content)
    elif filename.endswith(".csv"):
        raw_rows = _parse_csv(content)
    else:
        raise HTTPException(400, "File must be .csv or .xlsx")

    errors = []
    parsed = []
    for raw in raw_rows:
        result = _parse_row(raw)
        if isinstance(result, str):
            errors.append(result)
        else:
            parsed.append(result)

    if errors:
        raise HTTPException(422, detail={"errors": errors})

    # Get next order_idx per tier
    tier_counts: dict[str, int] = {}
    for tier_val in QuestionTier:
        count_res = await db.execute(
            select(func.count()).where(Question.tier == tier_val)
        )
        tier_counts[tier_val.value] = count_res.scalar_one() or 0

    created = []
    for row in parsed:
        tier = row["tier"]
        order_idx = tier_counts[tier.value]
        tier_counts[tier.value] += 1

        q = Question(
            tier=tier,
            order_idx=order_idx,
            question_mn=row["question_mn"],
            options_mn=row["options_mn"],
            correct_option_idx=row["correct_option_idx"],
            is_used=False,
            translation_status=TranslationStatus.PENDING,
        )
        db.add(q)
        created.append(q)

    await db.flush()
    for q in created:
        await db.refresh(q)

    # Translate all newly created questions
    for q in created:
        await _translate_question(q)

    await db.commit()

    return {
        "created": len(created),
        "questions": [QuestionResponse.model_validate(q) for q in created],
    }


@router.post("/{question_id}/translate", response_model=QuestionResponse)
async def retranslate_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Retry translation for a specific question."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")

    await _translate_question(q)
    await db.commit()
    await db.refresh(q)
    return q


@router.post("/trigger/{tier}", status_code=201)
async def trigger_next_question(
    tier: QuestionTier,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Manually activate the next question for a tier right now."""
    from app.core.game import activate_question_for_tier
    market = await activate_question_for_tier(tier, db, current_user.id)
    if not market:
        raise HTTPException(404, "No unused questions available for this tier")
    await db.commit()
    from app.schemas.market import MarketResponse
    return MarketResponse.model_validate(market)


@router.delete("/{question_id}", status_code=204)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")
    if q.is_used:
        raise HTTPException(400, "Cannot delete a question that has already been used")
    await db.delete(q)
    await db.commit()
