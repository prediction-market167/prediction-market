"""Admin endpoints for question management with multilingual CSV/Excel upload."""
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
from app.schemas.question import QuestionResponse

logger = logging.getLogger(__name__)

router = APIRouter()

TIER_OPTION_COUNT = {
    QuestionTier.FREE: 2,
    QuestionTier.EASY: 2,
    QuestionTier.MEDIUM: 2,
    QuestionTier.HARD: 4,
}

OPTION_LETTERS = ['a', 'b', 'c', 'd']
LANGUAGES = ['mn', 'en', 'ru', 'hi']


def _parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig").strip()
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for i, row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else '') for k, v in row.items()}
        rows.append({"_row": i, **row})
    return rows


def _parse_excel(content: bytes) -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip().lower() if h is not None else '' for h in rows[0]]
    result = []
    for i, row in enumerate(rows[1:], start=2):
        result.append({"_row": i, **dict(zip(headers, [str(v).strip() if v is not None else '' for v in row]))})
    return result


def _parse_row(raw: dict) -> dict | str:
    row_num = raw.get("_row", "?")
    tier_str = raw.get("tier", "").lower()
    if tier_str not in QuestionTier._value2member_map_:
        return f"Row {row_num}: invalid tier '{tier_str}' (must be free/easy/medium/hard)"

    tier = QuestionTier(tier_str)
    expected_count = TIER_OPTION_COUNT[tier]
    letters = OPTION_LETTERS[:expected_count]

    # Question text — MN required, others fall back to MN if missing
    question_mn = raw.get("question_mn", "").strip()
    if not question_mn:
        return f"Row {row_num}: missing question_mn"
    question_en = raw.get("question_en", "").strip() or question_mn
    question_ru = raw.get("question_ru", "").strip() or question_mn
    question_hi = raw.get("question_hi", "").strip() or question_mn

    # Options per language
    options: dict[str, list[str]] = {lang: [] for lang in LANGUAGES}
    for letter in letters:
        for lang in LANGUAGES:
            key = f"option_{letter}_{lang}"
            val = raw.get(key, "").strip()
            if not val:
                return f"Row {row_num}: missing {key}"
            options[lang].append(val)

    # Correct answer: a/b/c/d
    correct_raw = raw.get("correct_answer", "").strip().lower()
    if correct_raw not in letters:
        return f"Row {row_num}: correct_answer must be one of {letters} (got '{correct_raw}')"
    correct_idx = letters.index(correct_raw)

    return {
        "tier": tier,
        "question_mn": question_mn,
        "question_en": question_en,
        "question_ru": question_ru,
        "question_hi": question_hi,
        "options_mn": options["mn"],
        "options_en": options["en"],
        "options_ru": options["ru"],
        "options_hi": options["hi"],
        "correct_option_idx": correct_idx,
    }


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
    """Upload CSV or Excel file with questions in all 4 languages."""
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        raw_rows = _parse_excel(content)
    elif filename.endswith(".csv"):
        raw_rows = _parse_csv(content)
    else:
        raise HTTPException(400, "File must be .csv or .xlsx")

    if not raw_rows:
        raise HTTPException(422, detail={"errors": ["File is empty or has no data rows"]})

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
            question_en=row["question_en"],
            question_ru=row["question_ru"],
            question_hi=row["question_hi"],
            options_mn=row["options_mn"],
            options_en=row["options_en"],
            options_ru=row["options_ru"],
            options_hi=row["options_hi"],
            correct_option_idx=row["correct_option_idx"],
            is_used=False,
            translation_status=TranslationStatus.DONE,
        )
        db.add(q)
        created.append(q)

    await db.flush()
    for q in created:
        await db.refresh(q)

    await db.commit()

    return {
        "created": len(created),
        "questions": [QuestionResponse.model_validate(q) for q in created],
    }


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
