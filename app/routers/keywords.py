from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field



class ExtractKeywordsRequest(BaseModel):
    job_description: str = Field(..., description="The full job description text")
    max_keywords: Optional[int] = Field(default=25, ge=5, le=50)


class ExtractKeywordsResponse(BaseModel):
    keywords: List[str]


router = APIRouter(tags=["keywords"])


@router.post("/extract-keywords", response_model=ExtractKeywordsResponse)
def extract_keywords(payload: ExtractKeywordsRequest, request: Request) -> ExtractKeywordsResponse:
    try:
        keywords = request.app.state.keywords_service.extract_keywords_from_description(
            description=payload.job_description,
            num_keywords=payload.max_keywords or 25,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to extract keywords: {exc}")

    return ExtractKeywordsResponse(keywords=keywords)



class ExtractTitlesRequest(BaseModel):
    job_description: str = Field(..., description="The full job description text")
    max_titles: Optional[int] = Field(default=15, ge=3, le=50)
    max_keywords: Optional[int] = Field(default=None, ge=3, le=50, description="Alias for max_titles")


class ExtractTitlesResponse(BaseModel):
    titles: List[str]


@router.post("/extract-job-titles", response_model=ExtractTitlesResponse)
def extract_job_titles(payload: ExtractTitlesRequest, request: Request) -> ExtractTitlesResponse:
    try:
        # Accept either max_titles or max_keywords (max_keywords takes precedence if provided)
        limit = payload.max_keywords if payload.max_keywords is not None else payload.max_titles
        titles = request.app.state.keywords_service.extract_job_titles_from_description(
            description=payload.job_description,
            max_titles=limit or 15,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to extract job titles: {exc}")

    return ExtractTitlesResponse(titles=titles)

