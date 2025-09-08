from typing import Any, Dict, List, Optional
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright
import pandas as pd

from ..scrapers.scraper import (
    parse_indeed_graphql,
    GRAPHQL_ENDPOINT_SUBSTRING,
)


def perform_indeed_search(page, term: str, seen_request_ids: set, indeed_parser_module) -> Dict[str, Any]:
    """Run an Indeed search on the provided Playwright page and return parsed rows.

    This mirrors the earlier implementation but is moved under services/indeed.py.
    """
    if not term or not isinstance(term, str):
        raise ValueError("search term must be a non-empty string")

    try:
        page.wait_for_selector("#keywords_input", timeout=60000)
    except PlaywrightTimeoutError:
        raise PlaywrightTimeoutError("Indeed keywords input not found. Focus Indeed search page and try again.")

    # Submit search and wait for the Indeed GraphQL response
    try:
        with page.expect_response(lambda r: GRAPHQL_ENDPOINT_SUBSTRING in r.url, timeout=60000) as response_info:
            page.fill("#keywords_input", term)
            page.press("#keywords_input", "Enter")
        response = response_info.value
        data = response.json()

        def extract_req_id(payload: dict) -> str:
            return ((((payload or {}).get("data") or {}).get("findRCPMatches") or {}).get("rcpRequestId"))

        req_id = extract_req_id(data)

        # If this response is duplicate or not the expected shape, we do not loop here
        if not req_id or req_id in seen_request_ids:
            pass
        else:
            seen_request_ids.add(req_id)

    except PlaywrightTimeoutError:
        raise PlaywrightTimeoutError("Timeout waiting for Indeed GraphQL response")

    parsed = parse_indeed_graphql(data)
    matches = (parsed or {}).get("matches") or []
    df = pd.DataFrame(matches)

    rows_df = pd.DataFrame()
    rows_df["name"] = df.apply(indeed_parser_module.build_name, axis=1)
    rows_df["locale"] = df.get("locale")
    rows_df["location"] = df.get("location")
    rows_df["resume_type"] = df.get("resumeType")
    rows_df["free_to_contact"] = df.get("isFreeToContact")

    def _join_skills(xs):
        if isinstance(xs, list):
            return "; ".join([s.strip() for s in xs if isinstance(s, str) and s.strip()]) or None
        return None

    rows_df["skills"] = df["skills"].apply(_join_skills)

    edu_df = df["educations"].apply(indeed_parser_module.summarize_education)
    rows_df = pd.concat([rows_df, edu_df], axis=1)

    exp_df = df["experiences"].apply(indeed_parser_module.summarize_experiences)
    rows_df = pd.concat([rows_df, exp_df], axis=1)

    rows: List[Dict[str, Any]] = rows_df.where(pd.notna(rows_df), None).to_dict(orient="records")
    return {
        "rows": rows,
        "count": len(rows),
    }


class IndeedService:
    """Indeed operations including page selection policy (reuse existing tab)."""

    def _connect_browser(self):
        p = sync_playwright().start()
        try:
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
        except Exception as e:
            p.stop()
            raise RuntimeError(f"Failed to connect to Chrome on 9222: {e}")
        return p, browser

    def _find_existing_indeed_page(self, browser) -> Optional[Any]:
        try:
            for ctx in browser.contexts:
                for pg in ctx.pages:
                    try:
                        url = pg.url or ""
                    except Exception:
                        url = ""
                    if "indeed.com" in url:
                        return pg
        except Exception:
            return None
        return None

    def search_using_existing_page(self, term: str, seen_request_ids: set, indeed_parser_module) -> Dict[str, Any]:
        p, browser = self._connect_browser()
        try:
            page = self._find_existing_indeed_page(browser)
            if page is None:
                raise RuntimeError("No existing Indeed tab found. Open Indeed search in Chrome and try again.")

            return perform_indeed_search(
                page=page,
                term=term,
                seen_request_ids=seen_request_ids,
                indeed_parser_module=indeed_parser_module,
            )
        finally:
            try:
                browser.close()
            except Exception:
                pass
            try:
                p.stop()
            except Exception:
                pass

    def perform_indeed_search(self, page, term: str, seen_request_ids: set, indeed_parser_module) -> Dict[str, Any]:
        # Kept for compatibility, delegates to the standalone function
        return perform_indeed_search(page, term, seen_request_ids, indeed_parser_module)


