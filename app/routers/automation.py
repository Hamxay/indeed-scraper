from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import math


router = APIRouter(prefix="/automation", tags=["automation"])


class AutomationRequest(BaseModel):
    input: str = Field(..., description="Either a Dayforce job URL or a description text")
    max_keywords: int | None = Field(default=None, ge=3, le=50, description="Max number of titles/keywords to extract")


@router.post("/process")
def process(payload: AutomationRequest, request: Request):
    try:
        data = request.app.state.automation_service.process_input(
            user_input=payload.input,
            seen_request_ids=request.app.state.seen_request_ids,
            indeed_parser_module=request.app.state.indeed_parser_module,
            max_keywords=payload.max_keywords,
        )
        def _sanitize(val):
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    return None
                return val
            if isinstance(val, dict):
                return {k: _sanitize(v) for k, v in val.items()}
            if isinstance(val, (list, tuple)):
                return [_sanitize(x) for x in val]
            return val

        return _sanitize(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


