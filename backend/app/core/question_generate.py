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

CATEGORY_SEARCH_TERMS: dict[str, list[str]] = {
    "Science": ["physics", "chemistry", "biology", "astronomy", "mathematics", "genetics", "neuroscience", "quantum mechanics"],
    "History": ["ancient history", "world war", "revolution", "empire", "civilization", "dynasty", "renaissance", "medieval"],
    "Geography": ["country geography", "mountain range", "major river", "ocean", "continent", "capital city", "island nation"],
    "Sports": ["olympic games", "football world cup", "tennis grand slam", "world record", "basketball", "athletics championship"],
    "Technology": ["computer science", "internet history", "artificial intelligence", "programming language", "invention", "electronics", "semiconductor"],
    "Nature": ["animal species", "plant biology", "ecosystem", "climate change", "geology", "evolution", "wildlife conservation"],
    "Art": ["famous painting", "sculpture", "music composer", "world literature", "cinema history", "architecture", "famous artist"],
    "Economy": ["economics theory", "stock market", "international trade", "currency", "GDP", "banking history", "famous economist"],
}

WIKIPEDIA_REST = "https://en.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

CLAUDE_MODEL = "claude-sonnet-4-20250514"

TRUE_FALSE_EN = ["True", "False"]
TRUE_FALSE_RU = ["Верно", "Неверно"]
TRUE_FALSE_HI = ["सच", "झूठ"]

GENERATION_PROMPT = """\
You are a quiz question generator. Using the Wikipedia article summaries below, generate exactly {count} quiz questions.

TIER RULES:
- free: True/False only (2 options). options_en = ["True", "False"], options_ru = ["Верно", "Неверно"], options_hi = ["सच", "झूठ"]
- easy: True/False only (2 options). Same options as free.
- medium: Exactly 2 distinct answer choices (A and B).
- hard: Exactly 4 distinct answer choices (A, B, C, D).

TARGET DISTRIBUTION: roughly 25% each tier.

STRICT REQUIREMENTS:
- Every question must be grounded in a specific fact from the summaries below.
- Questions must be unambiguous — only one correct answer.
- No trick questions, no opinion-based questions.
- Provide all text in English (en), Russian (ru), and Hindi (hi).
- question_mn = question_en (copy the English question as the MN fallback).
- options_mn = options_en (copy English options as MN fallback).
- For free/easy: correct_option_idx = 0 means "True is correct", 1 means "False is correct".

ARTICLE SUMMARIES:
{articles}

OUTPUT: Return ONLY a JSON array. No markdown, no explanation, no code fences.
[
  {{
    "tier": "free",
    "question_en": "...",
    "question_ru": "...",
    "question_hi": "...",
    "options_en": ["True", "False"],
    "options_ru": ["Верно", "Неверно"],
    "options_hi": ["सच", "झूठ"],
    "correct_option_idx": 0
  }},
  {{
    "tier": "hard",
    "question_en": "...",
    "question_ru": "...",
    "question_hi": "...",
    "options_en": ["Option A", "Option B", "Option C", "Option D"],
    "options_ru": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
    "options_hi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
    "correct_option_idx": 2
  }}
]"""


async def _fetch_random_summaries(client: httpx.AsyncClient, num: int) -> list[str]:
    summaries: list[str] = []
    for _ in range(num):
        try:
            r = await client.get(f"{WIKIPEDIA_REST}/Special:Random", follow_redirects=True)
            if r.status_code == 200:
                data = r.json()
                extract = data.get("extract", "")
                title = data.get("title", "")
                if extract and len(extract) > 150:
                    summaries.append(f"**{title}**\n{extract[:1800]}")
        except Exception as exc:
            logger.warning("Wikipedia random fetch error: %s", exc)
    return summaries


async def _fetch_category_summaries(client: httpx.AsyncClient, category: str, num: int) -> list[str]:
    terms = CATEGORY_SEARCH_TERMS.get(category, ["knowledge"])
    term = random.choice(terms)
    summaries: list[str] = []
    try:
        r = await client.get(WIKIPEDIA_API, params={
            "action": "query",
            "list": "search",
            "srsearch": term,
            "srlimit": num * 4,
            "format": "json",
            "srnamespace": 0,
        })
        if r.status_code != 200:
            return summaries
        results = r.json().get("query", {}).get("search", [])
        random.shuffle(results)
        for item in results:
            if len(summaries) >= num:
                break
            title_encoded = item["title"].replace(" ", "_")
            try:
                s = await client.get(f"{WIKIPEDIA_REST}/{title_encoded}", follow_redirects=True)
                if s.status_code == 200:
                    data = s.json()
                    extract = data.get("extract", "")
                    if extract and len(extract) > 150:
                        summaries.append(f"**{item['title']}**\n{extract[:1800]}")
            except Exception as exc:
                logger.warning("Wikipedia summary fetch error for %s: %s", item["title"], exc)
    except Exception as exc:
        logger.warning("Wikipedia search error: %s", exc)
    return summaries


async def fetch_wikipedia_summaries(category: str, num_articles: int) -> list[str]:
    async with httpx.AsyncClient(timeout=30) as client:
        if category == "Random":
            return await _fetch_random_summaries(client, num_articles)
        return await _fetch_category_summaries(client, category, num_articles)


def _normalise_item(item: dict) -> dict | None:
    tier = str(item.get("tier", "")).lower().strip()
    if tier not in ("free", "easy", "medium", "hard"):
        return None

    q_en = str(item.get("question_en") or "").strip()
    q_ru = str(item.get("question_ru") or "").strip()
    q_hi = str(item.get("question_hi") or "").strip()
    if not q_en:
        return None

    opts_en = list(item.get("options_en") or [])
    opts_ru = list(item.get("options_ru") or [])
    opts_hi = list(item.get("options_hi") or [])

    expected = 2 if tier in ("free", "easy", "medium") else 4
    if len(opts_en) != expected:
        return None

    if tier in ("free", "easy"):
        opts_en = TRUE_FALSE_EN[:]
        opts_ru = TRUE_FALSE_RU[:]
        opts_hi = TRUE_FALSE_HI[:]

    correct_idx = int(item.get("correct_option_idx", 0))
    if correct_idx >= expected:
        correct_idx = 0

    return {
        "tier": tier,
        "question_mn": q_en,
        "question_en": q_en,
        "question_ru": q_ru or q_en,
        "question_hi": q_hi or q_en,
        "options_mn": opts_en[:],
        "options_en": opts_en,
        "options_ru": opts_ru if len(opts_ru) == expected else opts_en,
        "options_hi": opts_hi if len(opts_hi) == expected else opts_en,
        "correct_option_idx": correct_idx,
    }


async def generate_questions(category: str, count: int) -> list[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    num_articles = max(3, ceil(count / 3))
    summaries = await fetch_wikipedia_summaries(category, num_articles)
    if not summaries:
        raise ValueError("Could not fetch Wikipedia articles. Please try again.")

    articles_text = "\n\n---\n\n".join(summaries)
    prompt = GENERATION_PROMPT.format(count=count, articles=articles_text)

    client = AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if Claude added them
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) >= 2 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    items = json.loads(raw)
    return [n for item in items if (n := _normalise_item(item)) is not None]
