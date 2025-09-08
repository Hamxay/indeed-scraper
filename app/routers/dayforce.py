from fastapi import APIRouter, HTTPException, Response, Request
from playwright.sync_api import sync_playwright


router = APIRouter(prefix="/dayforce", tags=["dayforce"])


@router.get("/page-html")
def fetch_page_html(url: str, request: Request) -> Response:
    """Open a temporary tab to the given URL, return its HTML, and close only that tab."""
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Query parameter 'url' is required")

    try:
        html = request.app.state.dayforce_service.open_temp_page_and_get_html(url=url)
        return Response(content=html, media_type="text/html; charset=utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get-job-description")
def get_job_description(url: str, request: Request):
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Query parameter 'url' is required")

    try:
        text = request.app.state.dayforce_service.get_job_description_text(url=url)
        return {"url": url, "description": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


