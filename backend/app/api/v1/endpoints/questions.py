"""Admin endpoints for question management with multilingual CSV/Excel upload."""
import csv
import io
import logging
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, String

from app.db.session import get_db
from app.api.v1.deps import get_current_superuser
from app.models.user import User
from app.models.question import Question, QuestionTier, QuestionStatus, TranslationStatus
from app.schemas.question import (
    QuestionResponse, QuestionCountsResponse,
    GenerateRequest, GeneratedQuestionItem, GenerateResponse, SaveBatchRequest,
)

logger = logging.getLogger(__name__)


async def _tier_counts(db: AsyncSession) -> dict[str, int]:
    """Return {tier_value_str: count} using a single grouped query, avoiding enum binding."""
    rows = await db.execute(
        select(cast(Question.tier, String), func.count(Question.id)).group_by(Question.tier)
    )
    counts = {row[0]: row[1] for row in rows}
    for t in QuestionTier:
        counts.setdefault(t.value, 0)
    return counts

router = APIRouter()

TIER_OPTION_COUNT = {
    QuestionTier.free: 2,
    QuestionTier.easy: 2,
    QuestionTier.medium: 2,
    QuestionTier.hard: 4,
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

    question_mn = raw.get("question_mn", "").strip()
    if not question_mn:
        return f"Row {row_num}: missing question_mn"
    question_en = raw.get("question_en", "").strip() or question_mn
    question_ru = raw.get("question_ru", "").strip() or question_mn
    question_hi = raw.get("question_hi", "").strip() or question_mn

    options: dict[str, list[str]] = {lang: [] for lang in LANGUAGES}
    for letter in letters:
        for lang in LANGUAGES:
            key = f"option_{letter}_{lang}"
            val = raw.get(key, "").strip()
            if not val:
                return f"Row {row_num}: missing {key}"
            options[lang].append(val)

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


@router.get("/counts", response_model=QuestionCountsResponse)
async def question_counts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Return count of questions per status."""
    rows = await db.execute(
        select(Question.status, func.count(Question.id)).group_by(Question.status)
    )
    counts = {r[0]: r[1] for r in rows}
    return QuestionCountsResponse(
        unused=counts.get(QuestionStatus.unused, 0),
        scheduled_unused=counts.get(QuestionStatus.scheduled_unused, 0),
        used=counts.get(QuestionStatus.used, 0),
    )


@router.get("/", response_model=List[QuestionResponse])
async def list_questions(
    tier: QuestionTier | None = None,
    status: QuestionStatus | None = None,
    skip: int = 0,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    query = select(Question)
    if tier:
        query = query.where(Question.tier == tier)
    if status:
        query = query.where(Question.status == status)
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

    tier_counts = await _tier_counts(db)

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
            status=QuestionStatus.unused,
            translation_status=TranslationStatus.done,
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
        raise HTTPException(404, "No available questions for this tier")
    await db.commit()
    from app.schemas.market import MarketResponse
    return MarketResponse.model_validate(market)


@router.post("/{question_id}/reset", status_code=200)
async def reset_question_status(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Reset a scheduled_unused question back to unused so it goes to the end of the queue."""
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Question not found")
    if q.status != QuestionStatus.scheduled_unused:
        raise HTTPException(400, f"Only scheduled_unused questions can be reset (current: {q.status.value})")
    q.status = QuestionStatus.unused
    q.is_used = False
    await db.commit()
    return QuestionResponse.model_validate(q)


def _questions_to_db(parsed: list[dict], tier_counts: dict[str, int], db) -> list:
    """Create Question ORM objects from normalised dicts. Mutates tier_counts."""
    created = []
    for q_data in parsed:
        try:
            tier = QuestionTier(q_data["tier"])
        except ValueError:
            continue
        order_idx = tier_counts[tier.value]
        tier_counts[tier.value] += 1
        q = Question(
            tier=tier,
            order_idx=order_idx,
            question_mn=q_data["question_mn"],
            question_en=q_data["question_en"],
            question_ru=q_data["question_ru"],
            question_hi=q_data["question_hi"],
            options_mn=q_data["options_mn"],
            options_en=q_data["options_en"],
            options_ru=q_data["options_ru"],
            options_hi=q_data["options_hi"],
            correct_option_idx=q_data["correct_option_idx"],
            is_used=False,
            status=QuestionStatus.unused,
            translation_status=TranslationStatus.done,
        )
        db.add(q)
        created.append(q)
    return created


@router.post("/generate", response_model=GenerateResponse)
async def generate_questions_endpoint(
    req: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """
    Generate questions from Wikipedia + Claude.
    - free / easy / medium: saved directly to the database.
    - hard: returned as a preview list for admin approval before saving.
    """
    from app.core.question_generate import generate_questions
    try:
        questions = await generate_questions(req.category, req.count)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        logger.error("Question generation error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Generation failed: {exc}")
    if not questions:
        raise HTTPException(422, "No valid questions were generated. Please try again.")

    auto_save = [q for q in questions if q["tier"] != "hard"]
    hard_preview = [q for q in questions if q["tier"] == "hard"]

    try:
        tier_counts = await _tier_counts(db)
        created = _questions_to_db(auto_save, tier_counts, db)
        await db.flush()
        for q in created:
            await db.refresh(q)
        await db.commit()
    except Exception as exc:
        logger.error("Generate DB error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Database error: {exc}")

    return GenerateResponse(
        saved=len(created),
        preview=[GeneratedQuestionItem(**q) for q in hard_preview],
    )


@router.post("/auto-generate", status_code=201)
async def auto_generate_questions(
    _: User = Depends(get_current_superuser),
):
    """
    Trigger the full scheduled auto-generation (40 questions, 10 per tier)
    from a randomly chosen topic.  All questions are saved directly — no preview.
    """
    from app.core.question_generate import generate_questions_scheduled
    try:
        result = await generate_questions_scheduled(target_per_tier=10)
    except Exception as exc:
        logger.error("Auto-generate endpoint error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Auto-generation failed: {exc}")
    if result.get("error"):
        raise HTTPException(500, result["error"])
    return result


@router.post("/save-batch", status_code=201)
async def save_generated_questions(
    req: SaveBatchRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Persist a batch of generated (and admin-reviewed) questions."""
    tier_counts = await _tier_counts(db)

    created = []
    for item in req.questions:
        try:
            tier = QuestionTier(item.tier)
        except ValueError:
            continue
        order_idx = tier_counts[tier.value]
        tier_counts[tier.value] += 1

        q = Question(
            tier=tier,
            order_idx=order_idx,
            question_mn=item.question_mn,
            question_en=item.question_en,
            question_ru=item.question_ru,
            question_hi=item.question_hi,
            options_mn=item.options_mn,
            options_en=item.options_en,
            options_ru=item.options_ru,
            options_hi=item.options_hi,
            correct_option_idx=item.correct_option_idx,
            is_used=False,
            status=QuestionStatus.unused,
            translation_status=TranslationStatus.done,
        )
        db.add(q)
        created.append(q)

    await db.flush()
    for q in created:
        await db.refresh(q)
    await db.commit()
    return {"created": len(created), "questions": [QuestionResponse.model_validate(q) for q in created]}


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
    if q.status == QuestionStatus.used:
        raise HTTPException(400, "Cannot delete a question that has already been used")
    await db.delete(q)
    await db.commit()
