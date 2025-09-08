from camoufox.sync_api import Camoufox
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from dateutil import parser as date_parser
from datetime import date, datetime
import json
import os
import re
import time
import importlib.util
import sys
import pandas as pd


DAYFORCE_URL = "https://jobs.dayforcehcm.com/en-US/benchmark/CANDIDATEPORTAL"
INDEED_START_URL = "https://resumes.indeed.com/search"
GRAPHQL_ENDPOINT_SUBSTRING = "apis.indeed.com/graphql"


def ensure_results_dir() -> str:
    results_dir = os.path.join(os.getcwd(), "results")
    os.makedirs(results_dir, exist_ok=True)
    return results_dir


def sanitize_filename(name: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip()
    if not sanitized:
        sanitized = "untitled"
    return sanitized[:140]


def scrape_dayforce_titles(page) -> list:
    page.goto(DAYFORCE_URL)
    page.wait_for_selector("[test-id='job-posting-card'] [test-id='job-title']")
    job_cards = page.locator("[test-id='job-posting-card']").all()

    jobs = []
    for card in job_cards:
        title = (card.locator("[test-id='job-title']").text_content() or "").strip()
        posted_raw = (card.locator("[test-id='job-posted-date-expiry']").text_content() or "").strip()
        if posted_raw.lower().startswith("posted "):
            posted_text = posted_raw[7:].strip()
        else:
            posted_text = posted_raw
        try:
            posted_iso = date_parser.parse(posted_text).date().isoformat()
        except Exception:
            posted_iso = None
        jobs.append({"title": title, "posted_date": posted_iso})

    today_iso = date.today().isoformat()
    todays_titles = [job["title"] for job in jobs if job.get("posted_date") == today_iso and job.get("title")]
    return todays_titles


def parse_indeed_graphql(data: dict) -> dict:
    result = {
        "overallMatchCount": None,
        "matches": [],
    }

    try:
        matches_root = (((data or {}).get("data") or {}).get("findRCPMatches") or {})
        result["overallMatchCount"] = matches_root.get("overallMatchCount")
        match_list = (((matches_root.get("matchConnection") or {}).get("matches")) or [])

        for m in match_list:
            sp = (m or {}).get("sourcingProfile") or {}
            card = sp.get("profileCard") or {}
            location = (card.get("location") or {}).get("localizedValue")

            experiences = []
            for exp in (card.get("experiences") or []):
                experiences.append({
                    "title": exp.get("title"),
                    "company": exp.get("company"),
                    "fromDate": exp.get("fromDate"),
                    "toDate": exp.get("toDate"),
                })

            educations = []
            for edu in (card.get("educations") or []):
                educations.append({
                    "school": edu.get("school"),
                    "degree": edu.get("degree"),
                    "fromDate": edu.get("fromDate"),
                    "toDate": edu.get("toDate"),
                })

            skills = [s.get("text") for s in (card.get("skills") or []) if s.get("text")]

            result["matches"].append({
                "firstName": card.get("firstName"),
                "lastName": card.get("lastName"),
                "locale": card.get("locale"),
                "location": location,
                "resumeType": card.get("resumeType"),
                "isFreeToContact": card.get("isFreeToContact"),
                "experiences": experiences,
                "educations": educations,
                "skills": skills,
            })
    except Exception:
        # Keep parsing resilient; if the structure changes, return what we could
        pass

    return result


def load_indeed_parser_module():
    # Prefer the in-package parser located at app.scrapers.parser
    try:
        import importlib
        return importlib.import_module("app.scrapers.parser")
    except Exception as exc:
        raise RuntimeError(f"Failed to import in-package parser 'app.scrapers.parser': {exc}")


def write_pandas_outputs(parsed: dict, query: str, results_dir: str, indeed_parser_module) -> None:
    # Deprecated file outputs for API mode; retained for backwards compatibility but now no-ops
    return None


def search_indeed_and_collect(page, query: str, results_dir: str, seen_request_ids: set, indeed_parser_module) -> None:
    page.wait_for_selector("#keywords_input", timeout=60000)
    page.fill("#keywords_input", query)

    try:
        deadline = time.monotonic() + 60.0
        with page.expect_response(lambda r: GRAPHQL_ENDPOINT_SUBSTRING in r.url, timeout=60000) as response_info:
            page.click("[type='submit']")
        response = response_info.value
        data = response.json()

        def extract_req_id(payload: dict) -> str:
            return ((((payload or {}).get("data") or {}).get("findRCPMatches") or {}).get("rcpRequestId"))

        req_id = extract_req_id(data)

        # If this response is duplicate or not the expected shape, keep waiting for another matching response until timeout
        while not req_id or req_id in seen_request_ids:
            remaining_ms = max(1, int((deadline - time.monotonic()) * 1000))
            if remaining_ms <= 1:
                break
            try:
                with page.expect_response(lambda r: GRAPHQL_ENDPOINT_SUBSTRING in r.url, timeout=remaining_ms) as next_info:
                    pass
                next_response = next_info.value
                next_data = next_response.json()
                next_id = extract_req_id(next_data)
                if next_id and next_id not in seen_request_ids:
                    data = next_data
                    req_id = next_id
                    break
            except PlaywrightTimeoutError:
                break

        if not req_id:
            raise PlaywrightTimeoutError()

        seen_request_ids.add(req_id)

        parsed = parse_indeed_graphql(data)
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        safe_query = sanitize_filename(query)

        # Save parsed results
        parsed_out = {
            "query": query,
            "fetchedAt": timestamp,
            "rcpRequestId": req_id,
            "parsed": parsed,
        }
        parsed_path = os.path.join(results_dir, f"indeed_parsed_{safe_query}_{timestamp}.json")
        with open(parsed_path, "w", encoding="utf-8") as f:
            json.dump(parsed_out, f, indent=2, ensure_ascii=False)

        # Also save raw response for debugging/reference
        raw_path = os.path.join(results_dir, f"indeed_raw_{safe_query}_{timestamp}.json")
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"Saved parsed to: {parsed_path}")
        print(f"Saved raw to: {raw_path}")

        # Also generate CSV/JSONL via the pandas-based parser helpers
        try:
            write_pandas_outputs(parsed, query, results_dir, indeed_parser_module)
        except Exception as e:
            print(f"Parser integration failed for '{query}': {e}")

    except PlaywrightTimeoutError:
        page.screenshot(path=os.path.join(results_dir, "indeed_timeout_screenshot.jpg"), full_page=True)
        print("Timeout: failed to intercept apis.indeed.com/graphql")


def main():
    results_dir = ensure_results_dir()

    with Camoufox(headless=False, persistent_context=True, user_data_dir="user_data", geoip=True) as browser:
        page = browser.new_page()

        print("Scraping DayforceHCM titles posted today...")
        titles = scrape_dayforce_titles(page)
        if not titles:
            print("No titles posted today were found on DayforceHCM.")
            return

        print(f"Found {len(titles)} titles.")

        # Visit Indeed only once
        print("Opening Indeed search once...")
        page.goto(INDEED_START_URL)
        input("Complete any CAPTCHAs/logins if shown, then press Enter to continue...")
        page.wait_for_selector("#keywords_input", timeout=60000)

        seen_request_ids: set[str] = set()
        indeed_parser_module = load_indeed_parser_module()

        for idx, title in enumerate(titles, start=1):
            print(f"\n[{idx}/{len(titles)}] Searching Indeed for: {title}")
            search_indeed_and_collect(page, title, results_dir, seen_request_ids, indeed_parser_module)
            input("Press Enter to proceed to the next title...")


if __name__ == "__main__":
    main()


