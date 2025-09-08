import { transformApiResponse, AgentKey, type EvaluateResponse } from "../store/evaluationStore";

const API_BASE_URL = "https://0a122dd25a21.ngrok-free.app";

export interface EvaluateRequest {
  input: string;
  max_keywords?: number;
  max_candidates: number;
  experience_evaluator: boolean;
  skills_evaluator: boolean;
  culture_evaluator: boolean;
}

export async function evaluateCandidates(request: EvaluateRequest): Promise<EvaluateResponse> {
  const response = await fetch(`${API_BASE_URL}/automation/process`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function evaluate(
  jobDescription: string,
  agents: AgentKey[],
  candidateCount: number,
  maxKeywords: number = 3
) {
  return evaluateCandidates({
    input: jobDescription,
    max_keywords: maxKeywords,
    max_candidates: candidateCount,
    experience_evaluator: agents.includes("experience"),
    skills_evaluator: agents.includes("skills"),
    culture_evaluator: agents.includes("culture")
  });
}

export async function fetchJobDescription(url: string): Promise<string> {
  throw new Error("Job description fetching from URL is not yet implemented in the API");
}
