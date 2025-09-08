from fastapi import APIRouter, HTTPException, Request


router = APIRouter(prefix="/indeed", tags=["indeed"])


@router.get("/search/{term}")
def search(term: str, request: Request):
    try:
        result = request.app.state.search_service.search_using_existing_page(
            term=term,
            seen_request_ids=request.app.state.seen_request_ids,
            indeed_parser_module=request.app.state.indeed_parser_module,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "status": "ok",
        "query": term,
        "count": result["count"],
        "rows": result["rows"],
    }


