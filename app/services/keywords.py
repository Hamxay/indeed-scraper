from typing import List
from openai import OpenAI
import json


def extract_keywords_from_description(description: str, num_keywords: int = 25) -> List[str]:
    """Extract search-ready keywords from a job description using OpenAI.

    Args:
        description: The full job description text.
        num_keywords: Target maximum number of keywords to return.

    Returns:
        A list of keyword strings suitable for boolean/LinkedIn resume searches.
    """
    if not isinstance(description, str) or not description.strip():
        raise ValueError("job description must be a non-empty string")

    target_count = max(5, min(int(num_keywords or 25), 50))

    try:
        client = OpenAI()  # Uses OPENAI_API_KEY from environment
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize OpenAI client: {exc}")

    system_msg = (
        "You are a recruitment sourcing assistant. Given a job description, "
        "return concise, high-signal keywords (skills, titles, tools, certs, domains) "
        "that would be effective for boolean/LinkedIn resume searches. Avoid generic words."
    )

    user_msg = (
        "Extract up to "
        f"{target_count}"
        " highly relevant keywords from the following job description. "
        "Return ONLY a minified JSON object with this exact schema: "
        "{\"keywords\": [\"keyword1\", \"keyword2\", ...]} "
        "No code fences, no extra text.\n\n"
        f"JOB DESCRIPTION:\n{description.strip()}"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI completion failed: {exc}")

    text = (completion.choices[0].message.content or "").strip()

    # Try strict JSON parsing first
    try:
        data = json.loads(text)
        keywords = data.get("keywords") if isinstance(data, dict) else None
        if not isinstance(keywords, list):
            raise ValueError("Invalid response schema: 'keywords' is not a list")
    except Exception:
        # Fallback: attempt to extract JSON-like list
        # If model returned a bare list or comma-separated text
        if text.startswith("[") and text.endswith("]"):
            try:
                keywords = json.loads(text)
            except Exception as exc:
                raise RuntimeError(f"Failed to parse keywords list: {exc}")
        else:
            # Last-resort: split by commas
            keywords = [part.strip().strip('"\'') for part in text.split(",")]

    # Normalize: keep strings, strip empties, deduplicate preserving order
    seen = set()
    normalized: List[str] = []
    for kw in keywords:
        if isinstance(kw, str):
            clean = kw.strip()
            if clean and clean.lower() not in seen:
                seen.add(clean.lower())
                normalized.append(clean)

    return normalized[:target_count]



def extract_job_titles_from_description(description: str, max_titles: int = 15) -> List[str]:
    """Extract likely job/position titles from a job description using OpenAI.

    Args:
        description: The full job description text.
        max_titles: Target maximum number of distinct titles to return.

    Returns:
        A list of job/position titles (canonicalized, deduplicated).
    """
    if not isinstance(description, str) or not description.strip():
        raise ValueError("job description must be a non-empty string")

    target_count = max(3, min(int(max_titles or 15), 50))

    try:
        client = OpenAI()
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize OpenAI client: {exc}")

    system_msg = (
        "You are an expert technical recruiter. Given a single job description, "
        "identify the most probable job/position titles mentioned or implied. "
        "Include close synonyms and seniority variants (e.g., 'Software Engineer', 'Senior Software Engineer'). "
        "Exclude skills, tools, certifications, departments, benefits, company names, and locations. "
        "Return concise title strings in title case without extra commentary."
    )

    user_msg = (
        "Return up to "
        f"{target_count}"
        " distinct job/position titles found in or implied by this description. "
        "Return ONLY a minified JSON object with this exact schema: "
        '{"titles": ["title1", "title2", ...]}'
        " No code fences, no extra text.\n\n"
        f"JOB DESCRIPTION:\n{description.strip()}"
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI completion failed: {exc}")

    text = (completion.choices[0].message.content or "").strip()

    # Try strict JSON parsing first
    titles: List[str]
    try:
        data = json.loads(text)
        titles = data.get("titles") if isinstance(data, dict) else None  # type: ignore[assignment]
        if not isinstance(titles, list):
            raise ValueError("Invalid response schema: 'titles' is not a list")
    except Exception:
        # Fallbacks: bare list or comma-separated string
        if text.startswith("[") and text.endswith("]"):
            try:
                titles = json.loads(text)
            except Exception as exc:
                raise RuntimeError(f"Failed to parse titles list: {exc}")
        else:
            titles = [part.strip().strip('"\'') for part in text.split(",")]

    # Normalize titles: keep strings, strip empties, dedupe (case-insensitive), Title Case
    seen = set()
    normalized: List[str] = []
    for t in titles:
        if isinstance(t, str):
            clean = " ".join(t.strip().split())
            if not clean:
                continue
            lower = clean.lower()
            if lower in seen:
                continue
            seen.add(lower)
            # Basic canonicalization: title case but preserve common all-caps like CNA, RN
            words = [w if (len(w) <= 4 and w.isupper()) else w.title() for w in clean.split()]
            canonical = " ".join(words)
            normalized.append(canonical)

    return normalized[:target_count]


class KeywordsService:
    """Class-based wrapper around keyword and title extraction functions."""

    def extract_keywords_from_description(self, description: str, num_keywords: int = 25) -> List[str]:
        return extract_keywords_from_description(description=description, num_keywords=num_keywords)

    def extract_job_titles_from_description(self, description: str, max_titles: int = 15) -> List[str]:
        return extract_job_titles_from_description(description=description, max_titles=max_titles)