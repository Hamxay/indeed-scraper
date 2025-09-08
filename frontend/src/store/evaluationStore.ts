import { create } from 'zustand';

export type AgentKey = 'experience' | 'skills' | 'culture';

export interface CandidateDetails {
  name: string;
  locale?: string;
  location?: string;
  resume_type?: string;
  free_to_contact?: boolean;
  skills?: string;
  education_summary?: string;
  highest_degree?: string;
  experiences_json?: string;
  current_title?: string;
  total_experience_years?: number;
}

export interface CandidateResult {
  candidate: CandidateDetails;
  scores: Record<string, number>; // scores by agent (0-100)
  feedback: Record<string, string>; // feedback by agent
  overall_score: number;
}

export interface EvaluateResponse {
  total_candidates_evaluated: number;
  top_candidates_count: number;
  evaluators_used: AgentKey[];
  top_candidates: CandidateResult[];
}

// Legacy interface for backward compatibility in UI
export interface Candidate {
  id: string;
  name: string;
  currentTitle?: string;
  currentCompany?: string;
  yearsExperience?: number;
  scores?: Record<string, number>; // 0..1 by agent
  finalScore: number; // 0..1
  decision: 'advance' | 'hold' | 'reject';
  insights?: string[];
  agentRationales?: Record<string, string>;
  timeline?: {
    startedAt?: string;
    endedAt?: string;
    stages?: Array<{ name: string; ms: number }>;
  };
  raw?: any;
}

interface EvaluationState {
  // Form state
  jobDescription: string;
  jobUrl: string;
  selectedAgents: AgentKey[];
  candidateCount: 5 | 10 | 20;
  customCandidateCount: number;
  temperature: number;
  modelTag: string;
  requestNotes: string;

  
  // Evaluation state
  isEvaluating: boolean;
  results: { candidates: Candidate[]; meta: { runId: string; requestedAt: string; durationMs: number; agentsUsed: AgentKey[] } } | null;
  selectedCandidate: Candidate | null;
  
  // Actions
  setJobDescription: (description: string) => void;
  setJobUrl: (url: string) => void;
  setSelectedAgents: (agents: AgentKey[]) => void;
  setCandidateCount: (count: 5 | 10 | 20) => void;
  setCustomCandidateCount: (count: number) => void;
  setTemperature: (temp: number) => void;
  setModelTag: (tag: string) => void;
  setRequestNotes: (notes: string) => void;

  setIsEvaluating: (evaluating: boolean) => void;
  setResults: (results: { candidates: Candidate[]; meta: { runId: string; requestedAt: string; durationMs: number; agentsUsed: AgentKey[] } } | null) => void;
  setSelectedCandidate: (candidate: Candidate | null) => void;
  reset: () => void;
}

// Helper function to convert API response to legacy format for UI compatibility
export function transformApiResponse(apiResponse: EvaluateResponse): {
  candidates: Candidate[];
  meta: {
    runId: string;
    requestedAt: string;
    durationMs: number;
    agentsUsed: AgentKey[];
  };
} {
  const candidates: Candidate[] = apiResponse.top_candidates.map((result, index) => ({
    id: `candidate-${index}`,
    name: result.candidate.name,
    currentTitle: result.candidate.current_title,
    currentCompany: extractCompanyFromExperiences(result.candidate.experiences_json),
    yearsExperience: result.candidate.total_experience_years ? Math.floor(result.candidate.total_experience_years) : undefined,
    scores: Object.fromEntries(
      Object.entries(result.scores).map(([agent, score]) => [agent, score / 100]) // Convert 0-100 to 0-1
    ),
    finalScore: result.overall_score / 100, // Convert 0-100 to 0-1
    decision: getDecisionFromScore(result.overall_score),
    insights: extractInsights(result.feedback),
    agentRationales: result.feedback,
    timeline: generateMockTimeline(),
    raw: result
  }));

  return {
    candidates,
    meta: {
      runId: `run-${Date.now()}`,
      requestedAt: new Date().toISOString(),
      durationMs: Math.floor(Math.random() * 5000) + 2000,
      agentsUsed: apiResponse.evaluators_used
    }
  };
}

function extractCompanyFromExperiences(experiencesJson?: string): string | undefined {
  if (!experiencesJson) return undefined;
  try {
    const experiences = JSON.parse(experiencesJson);
    return experiences?.[0]?.company;
  } catch {
    return undefined;
  }
}

function getDecisionFromScore(score: number): 'advance' | 'hold' | 'reject' {
  if (score >= 85) return 'advance';
  if (score >= 70) return 'hold';
  return 'reject';
}

function extractInsights(feedback: Record<string, string>): string[] {
  return Object.values(feedback).map(text => {
    // Extract key insights from feedback text
    const sentences = text.split('.').filter(s => s.length > 20);
    return sentences[0]?.trim() || 'Strong candidate profile';
  });
}

function generateMockTimeline() {
  return {
    startedAt: new Date(Date.now() - Math.random() * 10000).toISOString(),
    endedAt: new Date().toISOString(),
    stages: [
      { name: 'Experience Analysis', ms: Math.floor(Math.random() * 1000) + 500 },
      { name: 'Skills Evaluation', ms: Math.floor(Math.random() * 1000) + 500 },
      { name: 'Culture Fit', ms: Math.floor(Math.random() * 1000) + 500 }
    ]
  };
}

export const useEvaluationStore = create<EvaluationState>((set) => ({
  // Initial state
  jobDescription: '',
  jobUrl: '',
  selectedAgents: ['experience', 'skills', 'culture'],
  candidateCount: 10,
  customCandidateCount: 10,
  temperature: 0.7,
  modelTag: 'gpt-4',
  requestNotes: '',

  
  isEvaluating: false,
  results: null,
  selectedCandidate: null,
  
  // Actions
  setJobDescription: (description) => set({ jobDescription: description }),
  setJobUrl: (url) => set({ jobUrl: url }),
  setSelectedAgents: (agents) => set({ selectedAgents: agents }),
  setCandidateCount: (count) => set({ candidateCount: count, customCandidateCount: count }),
  setCustomCandidateCount: (count) => set({ customCandidateCount: count }),
  setTemperature: (temp) => set({ temperature: temp }),
  setModelTag: (tag) => set({ modelTag: tag }),
  setRequestNotes: (notes) => set({ requestNotes: notes }),

  setIsEvaluating: (evaluating) => set({ isEvaluating: evaluating }),
  setResults: (results) => set({ results: results }),
  setSelectedCandidate: (candidate) => set({ selectedCandidate: candidate }),
  
  reset: () => set({
    jobDescription: '',
    jobUrl: '',
    selectedAgents: ['experience', 'skills', 'culture'],
    candidateCount: 10,
    customCandidateCount: 10,
    temperature: 0.7,
    modelTag: 'gpt-4',
    requestNotes: '',
    isEvaluating: false,
    results: null,
    selectedCandidate: null,
  }),
}));
