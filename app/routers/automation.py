from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import math
import httpx
import asyncio
from typing import List, Dict, Any
import json


router = APIRouter(prefix="/automation", tags=["automation"])


class AutomationRequest(BaseModel):
    input: str = Field(
        ..., description="Either a Dayforce job URL or a description text"
    )
    max_keywords: int | None = Field(
        default=None,
        ge=3,
        le=50,
        description="Max number of titles/keywords to extract",
    )
    max_candidates: int | None = Field(
        default=None, ge=1, le=100, description="Max number of candidates to extract"
    )

    # AI Evaluators
    experience_evaluator: bool = Field(
        default=False, description="Evaluates work history and career progression"
    )
    skills_evaluator: bool = Field(
        default=False, description="Assesses technical and domain expertise"
    )
    culture_evaluator: bool = Field(
        default=False, description="Analyzes cultural fit and values alignment"
    )


class CandidateEvaluationRequest(BaseModel):
    candidates: List[Dict[str, Any]] = Field(
        ..., description="List of candidate JSON objects with their information"
    )
    max_candidates: int = Field(
        default=5, ge=1, le=50, description="Maximum number of top candidates to return"
    )

    # AI Evaluators (default to False as requested)
    experience_evaluator: bool = Field(
        default=False, description="Evaluates work history and career progression"
    )
    skills_evaluator: bool = Field(
        default=False, description="Assesses technical and domain expertise"
    )
    culture_evaluator: bool = Field(
        default=False, description="Analyzes cultural fit and values alignment"
    )


@router.post("/process")
async def process(payload: AutomationRequest, request: Request):
    try:
        # 1) Run the synchronous automation service exactly like before
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            None,
            lambda: request.app.state.automation_service.process_input(
                user_input=payload.input,
                seen_request_ids=request.app.state.seen_request_ids,
                indeed_parser_module=request.app.state.indeed_parser_module,
                max_keywords=payload.max_keywords,
            ),
        )

        # 2) Sanitize helper (unchanged behavior)
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

        sanitized_data = _sanitize(data)

        # 3) Collect first 10 rows from each results[].rows and FLATTEN
        #    (handles missing keys safely)
        list_candidates: List[Dict[str, Any]] = []
        for block in sanitized_data.get("results", []) or []:
            rows = block.get("rows") or []
            list_candidates.extend(rows[:5])

        # If nothing to evaluate, return early with just the parsed payload
        if not list_candidates:
            return {
                "data": sanitized_data,
                "evaluation": None,
                "message": "No candidate rows found to evaluate.",
            }

        # 4) Build payload for the evaluate-candidates endpoint
        eval_request = CandidateEvaluationRequest(
            candidates=list_candidates,
            max_candidates=payload.max_candidates or 5,
            experience_evaluator=payload.experience_evaluator,
            skills_evaluator=payload.skills_evaluator,
            culture_evaluator=payload.culture_evaluator,
        )

        return await evaluate_candidates(eval_request)

    except HTTPException:
        # Re-raise API errors unchanged
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate-candidates")
async def evaluate_candidates(payload: CandidateEvaluationRequest):
    """
    Evaluate candidates using AI agents and return top candidates based on overall score
    """
    try:
        if not payload.candidates:
            raise HTTPException(status_code=400, detail="No candidates provided")

        # Check if at least one evaluator is enabled
        if not (
            payload.experience_evaluator
            or payload.skills_evaluator
            or payload.culture_evaluator
        ):
            raise HTTPException(
                status_code=400,
                detail="At least one evaluator must be enabled (experience_evaluator, skills_evaluator, or culture_evaluator)",
            )

        # AI Agent configurations
        agents = {
            "experience": {
                "enabled": payload.experience_evaluator,
                "agent_id": "68beb0a78a8eb0a43d847f3c",
                "session_id": "68beb0a78a8eb0a43d847f3c-bvm5biip669",
            },
            "skills": {
                "enabled": payload.skills_evaluator,
                "agent_id": "68beb0d68a8eb0a43d847f40",
                "session_id": "68beb0d68a8eb0a43d847f40-ad83easriqw",
            },
            "culture": {
                "enabled": payload.culture_evaluator,
                "agent_id": "68beb2b9cc9c7b45bbcc39c0",
                "session_id": "68beb2b9cc9c7b45bbcc39c0-0d4oneo6nnb",
            },
        }

        evaluated_candidates = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            for candidate in payload.candidates:
                candidate_scores = {"experience": 0, "skills": 0, "culture": 0}
                candidate_feedback = {"experience": "", "skills": "", "culture": ""}

                # Prepare candidate information as a formatted string
                candidate_info = format_candidate_info(candidate)

                # Evaluate with each enabled agent
                tasks = []
                for agent_type, config in agents.items():
                    if config["enabled"]:
                        task = evaluate_with_agent(
                            client, agent_type, config, candidate_info
                        )
                        tasks.append((agent_type, task))

                # Execute all agent evaluations concurrently
                for agent_type, task in tasks:
                    try:
                        score, feedback = await task
                        candidate_scores[agent_type] = score
                        candidate_feedback[agent_type] = feedback
                    except Exception as e:
                        print(f"Error evaluating {agent_type} for candidate: {e}")
                        candidate_scores[agent_type] = 0
                        candidate_feedback[agent_type] = f"Error: {str(e)}"

                # Calculate overall score (average of enabled evaluators)
                enabled_scores = [
                    score
                    for agent_type, score in candidate_scores.items()
                    if agents[agent_type]["enabled"] and score > 0
                ]
                overall_score = (
                    sum(enabled_scores) / len(enabled_scores) if enabled_scores else 0
                )

                evaluated_candidates.append(
                    {
                        "candidate": candidate,
                        "scores": candidate_scores,
                        "feedback": candidate_feedback,
                        "overall_score": overall_score,
                    }
                )

        # Sort by overall score (highest first) and limit to max_candidates
        # print("evaluated_candidates", evaluated_candidates)
        evaluated_candidates.sort(key=lambda x: x["overall_score"], reverse=True)
        top_candidates = evaluated_candidates[: payload.max_candidates]
        print("top_candidates", top_candidates)

        return {
            "total_candidates_evaluated": len(payload.candidates),
            "top_candidates_count": len(top_candidates),
            "evaluators_used": [
                agent_type for agent_type, config in agents.items() if config["enabled"]
            ],
            "top_candidates": top_candidates,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def format_candidate_info(candidate: Dict[str, Any]) -> str:
    """
    Format candidate information for AI agent evaluation
    """
    info_parts = []

    # Basic information
    info_parts.append(f"Name: {candidate.get('name', 'N/A')}")
    info_parts.append(f"Location: {candidate.get('location', 'N/A')}")
    info_parts.append(f"Current Title: {candidate.get('current_title', 'N/A')}")
    info_parts.append(
        f"Total Experience: {candidate.get('total_experience_years', 'N/A')} years"
    )

    # Education
    if candidate.get("education_summary"):
        info_parts.append(f"Education: {candidate['education_summary']}")
    if candidate.get("highest_degree"):
        info_parts.append(f"Highest Degree: {candidate['highest_degree']}")

    # Skills
    if candidate.get("skills"):
        info_parts.append(f"Skills: {candidate['skills']}")

    # Work Experience
    if candidate.get("experiences_json"):
        try:
            experiences = json.loads(candidate["experiences_json"])
            info_parts.append("Work Experience:")
            for exp in experiences:
                if exp.get("title") and exp.get("company"):
                    duration = exp.get("duration_months", 0)
                    duration_years = round(duration / 12, 1) if duration else "Unknown"
                    info_parts.append(
                        f"  - {exp['title']} at {exp['company']} ({duration_years} years)"
                    )
        except json.JSONDecodeError:
            info_parts.append(f"Work Experience: {candidate['experiences_json']}")

    return "\n".join(info_parts)


async def evaluate_with_agent(
    client: httpx.AsyncClient, agent_type: str, config: Dict, candidate_info: str
):
    """
    Evaluate a candidate with a specific AI agent
    """
    prompt = f"""
    Please evaluate the following candidate for {agent_type} assessment:
    
    {candidate_info}
    
    Please provide:
    1. A score from 0-100 (where 100 is excellent)
    2. Brief feedback explaining the score
    
    Format your response as:
    Score: [number]
    Feedback: [your assessment]
    """

    payload = {
        "user_id": "dev.hamza341@gmail.com",
        "agent_id": config["agent_id"],
        "session_id": config["session_id"],
        "message": prompt,
    }

    response = await client.post(
        "https://agent-prod.studio.lyzr.ai/v3/inference/chat/",
        headers={
            "Content-Type": "application/json",
            "x-api-key": "sk-default-I0SEUWVC3kE1VisOjzBnNVr2G3nph1oM",
        },
        json=payload,
    )

    if response.status_code != 200:
        raise Exception(f"Agent API error: {response.status_code} - {response.text}")

    result = response.json()
    agent_response = result.get("response", "")

    # Parse score and feedback from agent response
    score = 0
    feedback = agent_response

    try:
        lines = agent_response.split("\n")
        for line in lines:
            if line.startswith("Score:"):
                score_text = line.replace("Score:", "").strip()
                score = int(float(score_text))
                break
    except:
        # If parsing fails, try to extract any number from the response
        import re

        numbers = re.findall(r"\b\d+\b", agent_response)
        if numbers:
            score = min(100, max(0, int(numbers[0])))

    return score, feedback
