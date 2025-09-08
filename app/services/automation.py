from typing import Dict, List
import re


DAYFORCE_JOB_RE = re.compile(r"^https?://jobs\.dayforcehcm\.com/.*?/CANDIDATEPORTAL/jobs/\d+", re.IGNORECASE)


class AutomationService:
    def __init__(self, dayforce_service, keywords_service, indeed_service):
        self.dayforce_service = dayforce_service
        self.keywords_service = keywords_service
        self.indeed_service = indeed_service

    def _is_dayforce_job_url(self, s: str) -> bool:
        if not isinstance(s, str) or not s.strip():
            return False
        return bool(DAYFORCE_JOB_RE.match(s.strip()))

    def process_input(self, user_input: str, seen_request_ids: set, indeed_parser_module, max_keywords: int | None = None) -> Dict[str, object]:
        if not isinstance(user_input, str) or not user_input.strip():
            raise ValueError("Input must be a non-empty string (URL or text)")

        # 1) Resolve text to analyze
        if self._is_dayforce_job_url(user_input):
            description_text = self.dayforce_service.get_job_description_text(url=user_input)
            source = "dayforce"
        else:
            description_text = user_input
            source = "text"

        if not description_text:
            return {"source": source, "keywords": [], "queries": [], "results": []}

        # 2) Extract keywords / job descriptors
        target = None
        if isinstance(max_keywords, int):
            try:
                target = max(3, min(int(max_keywords), 50))
            except Exception:
                target = None

        keywords: List[str] = self.keywords_service.extract_job_titles_from_description(
            description=description_text,
            max_titles=target or 15,
        )

        # 3) For each descriptor, search Indeed using existing page
        results: List[Dict[str, object]] = []
        for q in keywords:
            if not isinstance(q, str) or not q.strip():
                continue
            data = self.indeed_service.search_using_existing_page(
                term=q.strip(),
                seen_request_ids=seen_request_ids,
                indeed_parser_module=indeed_parser_module,
            )
            results.append({
                "query": q,
                "count": data.get("count"),
                "rows": data.get("rows"),
            })

        return {
            "source": source,
            "description": description_text,
            "keywords": keywords,
            "queries": keywords,
            "results": results,
        }


