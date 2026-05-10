"""Generate quiz questions from Wikipedia summaries via Claude API."""
from __future__ import annotations

import json
import logging
import os
import random
from math import ceil

import httpx
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

# ── All 20 rotatable topics ───────────────────────────────────────────────────

ALL_TOPICS = [
    "Science", "History", "Geography", "Sports", "Technology",
    "Nature", "Art", "Economy", "Biology", "Physics",
    "Chemistry", "Literature", "Music", "Film", "Architecture",
    "Medicine", "Mathematics", "Space", "Ocean", "Animals",
]

CATEGORY_SEARCH_TERMS: dict[str, list[str]] = {
    "Science":       ["physics", "chemistry", "biology", "astronomy", "genetics", "neuroscience", "quantum mechanics"],
    "History":       ["ancient history", "world war", "revolution", "empire", "civilization", "dynasty", "renaissance", "medieval"],
    "Geography":     ["country geography", "mountain range", "major river", "ocean", "continent", "capital city", "island nation"],
    "Sports":        ["olympic games", "football world cup", "tennis grand slam", "world record", "basketball", "athletics championship"],
    "Technology":    ["computer science", "internet history", "artificial intelligence", "programming language", "invention", "electronics", "semiconductor"],
    "Nature":        ["animal species", "plant biology", "ecosystem", "climate change", "geology", "evolution", "wildlife conservation"],
    "Art":           ["famous painting", "sculpture", "music composer", "world literature", "cinema history", "architecture", "famous artist"],
    "Economy":       ["economics theory", "stock market", "international trade", "currency", "GDP", "banking history", "famous economist"],
    "Biology":       ["cell biology", "genetics", "evolution", "microbiology", "ecology", "photosynthesis", "DNA", "proteins"],
    "Physics":       ["classical mechanics", "thermodynamics", "electromagnetism", "quantum physics", "relativity", "optics", "nuclear physics"],
    "Chemistry":     ["periodic table", "chemical reactions", "organic chemistry", "elements", "molecules", "acids", "polymers"],
    "Literature":    ["classic novel", "poetry", "playwright", "literary movement", "Nobel Prize literature", "Shakespeare", "mythology"],
    "Music":         ["classical music", "music genre", "famous composer", "music history", "musical instrument", "opera", "jazz"],
    "Film":          ["cinema history", "Oscar award", "famous director", "film genre", "silent film", "Hollywood", "animation"],
    "Architecture":  ["ancient architecture", "famous building", "architectural style", "skyscraper", "cathedral", "bridge design", "urban planning"],
    "Medicine":      ["human anatomy", "disease history", "vaccine", "surgery history", "pharmacy", "genetics medicine", "epidemiology"],
    "Mathematics":   ["mathematics history", "geometry", "algebra", "calculus", "prime numbers", "probability", "famous mathematician"],
    "Space":         ["solar system", "galaxy", "star", "planet", "NASA", "space exploration", "black hole", "cosmology"],
    "Ocean":         ["ocean current", "marine biology", "coral reef", "deep sea", "tides", "sea creatures", "oceanography"],
    "Animals":       ["mammal species", "bird species", "reptile", "insect", "endangered species", "predator", "migration"],
}

WIKIPEDIA_RANDOM  = "https://en.wikipedia.org/api/rest_v1/page/random/summary"
WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_API     = "https://en.wikipedia.org/w/api.php"

_WIKI_HEADERS = {
    "User-Agent": "PredictionMarketBot/1.0 (https://github.com/prediction-market167/prediction-market; telegrambotmon@gmail.com) httpx/0.27",
    "Accept": "application/json",
}

CLAUDE_MODEL = "claude-sonnet-4-6"

# ── Fixed True/False values ───────────────────────────────────────────────────

TF_EN = ("TRUE",  "FALSE")
TF_RU = ("ВЕРНО", "НЕВЕРНО")
TF_HI = ("सही",  "गलत")

# ── Claude prompt ─────────────────────────────────────────────────────────────

GENERATION_PROMPT = """\
You are a quiz question generator. Use the Wikipedia article summaries below to generate exactly {count} quiz questions.

TIER RULES:
- free  : True/False question. Use exactly: option_a = TRUE/ВЕРНО/सही, option_b = FALSE/НЕВЕРНО/गलत
- easy  : True/False question. Same fixed options as free.
- medium: Exactly 2 distinct choices (option_a and option_b).
- hard  : Exactly 4 distinct choices (option_a, option_b, option_c, option_d).

TARGET DISTRIBUTION: {tier_targets}

STRICT REQUIREMENTS:
- Every question must be grounded in a specific fact from the summaries.
- Questions must be unambiguous — only one correct answer.
- No trick questions, no opinion questions.
- Translate question text AND all options into Russian (ru) and Hindi (hi).
- For free/easy: correct_answer must be "a" (TRUE) or "b" (FALSE).
- For medium: correct_answer is "a" or "b".
- For hard: correct_answer is "a", "b", "c", or "d".

ARTICLE SUMMARIES:
{articles}

Return ONLY valid JSON — no markdown, no code fences, no explanation:
{{
  "questions": [
    {{
      "tier": "free",
      "question_en": "...",
      "question_ru": "...",
      "question_hi": "...",
      "option_a_en": "TRUE",  "option_a_ru": "ВЕРНО",   "option_a_hi": "सही",
      "option_b_en": "FALSE", "option_b_ru": "НЕВЕРНО", "option_b_hi": "गलत",
      "correct_answer": "a"
    }},
    {{
      "tier": "hard",
      "question_en": "...",
      "question_ru": "...",
      "question_hi": "...",
      "option_a_en": "...", "option_a_ru": "...", "option_a_hi": "...",
      "option_b_en": "...", "option_b_ru": "...", "option_b_hi": "...",
      "option_c_en": "...", "option_c_ru": "...", "option_c_hi": "...",
      "option_d_en": "...", "option_d_ru": "...", "option_d_hi": "...",
      "correct_answer": "b"
    }}
  ]
}}"""

# ── Wikipedia helpers ─────────────────────────────────────────────────────────

async def _fetch_random_summaries(client: httpx.AsyncClient, num: int) -> list[str]:
    summaries: list[str] = []
    for i in range(num):
        try:
            r = await client.get(WIKIPEDIA_RANDOM, follow_redirects=True)
            logger.debug("Wikipedia random[%d] status=%s", i, r.status_code)
            if r.status_code == 200:
                data = r.json()
                extract = data.get("extract", "")
                title   = data.get("title", "")
                if extract and len(extract) > 150:
                    summaries.append(f"**{title}**\n{extract[:1800]}")
                else:
                    logger.debug("Wikipedia random[%d] skipped: short extract (%d chars)", i, len(extract))
            else:
                logger.error("Wikipedia random[%d] error: HTTP %s — %s", i, r.status_code, r.text[:200])
        except Exception as exc:
            logger.error("Wikipedia random[%d] exception: %s", i, exc, exc_info=True)
    return summaries


async def _fetch_category_summaries(client: httpx.AsyncClient, category: str, num: int) -> list[str]:
    terms = CATEGORY_SEARCH_TERMS.get(category, ["knowledge"])
    term  = random.choice(terms)
    logger.info("Wikipedia category=%r search term=%r", category, term)
    summaries: list[str] = []
    try:
        r = await client.get(WIKIPEDIA_API, params={
            "action": "query", "list": "search",
            "srsearch": term, "srlimit": num * 4,
            "format": "json", "srnamespace": 0,
        })
        logger.debug("Wikipedia search status=%s", r.status_code)
        if r.status_code != 200:
            logger.error("Wikipedia search error: HTTP %s — %s", r.status_code, r.text[:200])
            return summaries
        results = r.json().get("query", {}).get("search", [])
        logger.info("Wikipedia search returned %d results for %r", len(results), term)
        random.shuffle(results)
        for item in results:
            if len(summaries) >= num:
                break
            title_encoded = item["title"].replace(" ", "_")
            try:
                s = await client.get(
                    f"{WIKIPEDIA_SUMMARY}/{title_encoded}",
                    follow_redirects=True,
                )
                if s.status_code == 200:
                    data = s.json()
                    extract = data.get("extract", "")
                    if extract and len(extract) > 150:
                        summaries.append(f"**{item['title']}**\n{extract[:1800]}")
                else:
                    logger.debug("Wikipedia summary for %r: HTTP %s", item["title"], s.status_code)
            except Exception as exc:
                logger.error("Wikipedia summary fetch for %r: %s", item["title"], exc)
    except Exception as exc:
        logger.error("Wikipedia search exception: %s", exc, exc_info=True)
    logger.info("Wikipedia fetched %d/%d summaries for category=%r", len(summaries), num, category)
    return summaries


async def fetch_wikipedia_summaries(category: str, num_articles: int) -> list[str]:
    async with httpx.AsyncClient(timeout=30, headers=_WIKI_HEADERS) as client:
        if category in ("Random", "RandomMix"):
            summaries = await _fetch_random_summaries(client, num_articles)
        else:
            summaries = await _fetch_category_summaries(client, category, num_articles)
        if not summaries:
            logger.error(
                "fetch_wikipedia_summaries returned 0 results for category=%r num=%d",
                category, num_articles,
            )
        return summaries

# ── Response normalisation ────────────────────────────────────────────────────

_LETTERS = ["a", "b", "c", "d"]
_LETTER_IDX = {"a": 0, "b": 1, "c": 2, "d": 3}


def _normalise_item(item: dict) -> dict | None:
    tier = str(item.get("tier", "")).lower().strip()
    if tier not in ("free", "easy", "medium", "hard"):
        return None

    q_en = str(item.get("question_en") or "").strip()
    q_ru = str(item.get("question_ru") or "").strip()
    q_hi = str(item.get("question_hi") or "").strip()
    if not q_en:
        return None

    correct_letter = str(item.get("correct_answer", "a")).lower().strip()
    correct_idx    = _LETTER_IDX.get(correct_letter, 0)

    expected_letters = _LETTERS[:2] if tier in ("free", "easy", "medium") else _LETTERS[:4]

    if tier in ("free", "easy"):
        opts_en = list(TF_EN)
        opts_ru = list(TF_RU)
        opts_hi = list(TF_HI)
        correct_idx = 0 if correct_letter == "a" else 1
    else:
        opts_en = [str(item.get(f"option_{l}_en", "")).strip() for l in expected_letters]
        opts_ru = [str(item.get(f"option_{l}_ru", "")).strip() for l in expected_letters]
        opts_hi = [str(item.get(f"option_{l}_hi", "")).strip() for l in expected_letters]
        if not all(opts_en):
            return None

    if correct_idx >= len(expected_letters):
        correct_idx = 0

    return {
        "tier":              tier,
        "question_mn":       q_en,
        "question_en":       q_en,
        "question_ru":       q_ru or q_en,
        "question_hi":       q_hi or q_en,
        "options_mn":        opts_en[:],
        "options_en":        opts_en,
        "options_ru":        opts_ru if all(opts_ru) else opts_en,
        "options_hi":        opts_hi if all(opts_hi) else opts_en,
        "correct_option_idx": correct_idx,
    }


def _parse_claude_response(raw: str) -> list[dict]:
    # Strip markdown code fences if Claude added them
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) >= 2 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    parsed = json.loads(text)
    # Accept both {"questions": [...]} and bare [...]
    if isinstance(parsed, dict):
        items = parsed.get("questions", [])
    elif isinstance(parsed, list):
        items = parsed
    else:
        items = []

    return [n for item in items if (n := _normalise_item(item)) is not None]

# ── Public API ────────────────────────────────────────────────────────────────

async def generate_questions(category: str, count: int) -> list[dict]:
    """
    Fetch Wikipedia articles for the given category and ask Claude to generate
    `count` quiz questions.  Returns normalised question dicts.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    num_articles = max(3, ceil(count / 3))
    summaries = await fetch_wikipedia_summaries(category, num_articles)
    if not summaries:
        raise ValueError("Could not fetch Wikipedia articles. Please try again.")

    # Build tier targets string for the prompt
    per_tier = max(1, count // 4)
    n_free   = max(1, count - per_tier * 3)
    tier_targets = (
        f"{n_free} free, {per_tier} easy, {per_tier} medium, {per_tier} hard"
    )

    articles_text = "\n\n---\n\n".join(summaries)
    prompt = GENERATION_PROMPT.format(
        count=count,
        tier_targets=tier_targets,
        articles=articles_text,
    )

    client = AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": prompt}],
    )

    return _parse_claude_response(message.content[0].text)


async def generate_questions_scheduled(target_per_tier: int = 10) -> dict:
    """
    Generate `target_per_tier` questions for each of the 4 tiers (default 40 total)
    from a randomly chosen topic.  Saves all questions directly to the database.
    Returns a summary dict.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        logger.warning("Scheduled question generation skipped: ANTHROPIC_API_KEY not set")
        return {"saved": 0, "error": "ANTHROPIC_API_KEY not set"}

    category = random.choice(ALL_TOPICS)
    count    = target_per_tier * 4
    logger.info("Scheduled question generation: category=%s count=%d", category, count)

    try:
        questions = await generate_questions(category, count)
    except Exception as exc:
        logger.error("Scheduled generation failed: %s", exc)
        return {"saved": 0, "error": str(exc)}

    if not questions:
        return {"saved": 0, "error": "No questions generated"}

    from sqlalchemy import select, func as sqlfunc, cast, String
    from app.db.session import AsyncSessionLocal
    from app.models.question import Question, QuestionTier, QuestionStatus, TranslationStatus

    saved = 0
    try:
        async with AsyncSessionLocal() as db:
            # Single grouped query — avoids enum-name binding bug with asyncpg
            rows = await db.execute(
                select(cast(Question.tier, String), sqlfunc.count(Question.id)).group_by(Question.tier)
            )
            tier_counts: dict[str, int] = {row[0]: row[1] for row in rows}
            for t in QuestionTier:
                tier_counts.setdefault(t.value, 0)

            for q_data in questions:
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
                saved += 1

            await db.commit()
    except Exception as exc:
        logger.error("Scheduled generation DB error: %s", exc, exc_info=True)
        return {"saved": 0, "error": f"Database error: {exc}"}

    logger.info("Scheduled generation complete: saved %d questions", saved)
    return {"saved": saved, "category": category}
