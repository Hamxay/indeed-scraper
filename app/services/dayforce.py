from typing import Optional
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


class DayforceService:
    def _connect_browser(self):
        p = sync_playwright().start()
        try:
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
        except Exception as e:
            p.stop()
            raise RuntimeError(f"Failed to connect to Chrome on 9222: {e}")
        return p, browser

    def open_temp_page_and_get_html(self, url: str, timeout_ms: int = 60000) -> str:
        if not url or not isinstance(url, str):
            raise ValueError("url must be a non-empty string")

        p, browser = self._connect_browser()
        try:
            context = browser.contexts[0]
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                return page.content() or ""
            finally:
                try:
                    page.close()
                except Exception:
                    pass
        finally:
            try:
                browser.close()
            except Exception:
                pass
            try:
                p.stop()
            except Exception:
                pass
    def get_job_description_text(self, url: str, timeout_ms: int = 60000) -> str:
        if not url or not isinstance(url, str):
            raise ValueError("url must be a non-empty string")

        p, browser = self._connect_browser()
        try:
            context = browser.contexts[0]
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                try:
                    page.wait_for_selector('[test-id="job-detail-body"]', timeout=timeout_ms)
                except PlaywrightTimeoutError:
                    raise PlaywrightTimeoutError("job-detail-body element not found")

                text: Optional[str] = page.locator('[test-id="job-detail-body"]').text_content()
                return (text or "").strip()
            finally:
                try:
                    page.close()
                except Exception:
                    pass
        finally:
            try:
                browser.close()
            except Exception:
                pass
            try:
                p.stop()
            except Exception:
                pass


