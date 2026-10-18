// Shared TypeScript types used across components and hooks
export type Provider = 'openai' | 'claude' | 'gemini'
export type ChatProvider = Provider | 'auto'

export type Role = 'student' | 'instructor' | 'admin'

export type Track = 'language' | 'dsa' | 'algorithm' | 'design-patterns'
export type Mode = 'browse' | 'learn' | 'practice'

export interface User {
  id: string
  email: string
  peppercorns: number
  role: Role
  preferred_language: string
  status?: 'active' | 'suspended'
  strikes?: number
  created_at?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface SourceCitation {
  document_id: string
  filename: string
  revision: string
  excerpt: string
}

export interface RetrievalReport {
  strategy: 'agentic' | 'standard_local'
  searches: number
  model_calls: number
  elapsed_ms: number
  input_tokens: number
  output_tokens: number
  usage_complete: boolean
  fallback: string | null
  clarification: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: SourceCitation[]
  retrieval?: RetrievalReport | null
}

export interface ChatResponse {
  answer: string
  thread_id: string
  peppercorns_remaining: number
  sources?: SourceCitation[]
  retrieval?: RetrievalReport | null
  model_routing?: {
    strategy: 'automatic' | 'manual'
    task: 'explain' | 'code' | 'reasoning' | null
    provider: Provider
    model: string
    fallback_used: boolean
  } | null
}

export interface AnalysisResult {
  mistakes: string[]
  enhancements: string[]
  watchouts: string[]
  interview_tips: string[]
  overall_feedback: string
}

export interface AnalyzeResponse {
  solution_available: boolean
  evidence?: Evidence | null
  analysis: AnalysisResult
  peppercorns_remaining: number
}

export interface ProblemMeta {
  id: string
  title: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | string
  category: string
}


export interface LangResult {
  language: string
  tier: number
  status: 'passed' | 'failed' | 'unverified' | 'error'
  detail: string
  passed_cases: number
  total_cases: number
}

export interface ValidationReport {
  results: LangResult[]
  agreement: boolean
  agreement_detail: string
  can_publish: boolean
  unverified: string[]
  toolchains: Record<string, boolean>
}

export interface TrainResult {
  status: 'published' | 'needs_review'
  problem_id: string
  title: string
  issues_found: string[]
  corrections: Record<string, string[]>
  generated_languages: string[]
  unverified_languages: string[]
  validation: ValidationReport
  stages: Array<Record<string, unknown>>
  markdown: string
}

export interface TrainingStatus {
  role: string
  toolchains: Record<string, boolean>
  executed_languages: string[]
  compiled_languages: string[]
  unavailable: string[]
  note: string
}


export interface ContentMeta {
  id: string
  title: string
  track: Track
  difficulty: string
  category: string
  language: string | null
  algorithms: string[]
  source: string
  io_mode: string
  order: number
  prerequisites: string[]
  starter_code: string
  has_tests: boolean
  level: string | null
}

export interface TrackSummary {
  track: Track
  label: string
  blurb: string
  count: number
}

export interface TracksResponse {
  tracks: TrackSummary[]
  languages: string[]
  preferred_language: string | null
  training_languages?: string[]
  modes: Mode[]
}


export interface MentorResponse {
  reply: string
  hint_tier: number
  tier_label: string
  recalled_moment: string | null
  step_back_offer: {
    algorithm: string
    concept: { id: string; title: string } | null
    easier_problem: { id: string; title: string } | null
    message: string
  } | null
  peppercorns_remaining: number
}

export interface Entitlement {
  language: string
  entitled: boolean
  reason: string
  expires_at: string | null
}

export interface Subscription {
  id: string
  language: string
  status: string
  expires_at: string
}

export interface RecurringError {
  category: string
  count: number
  lesson: string
}

export interface LearningProfileData {
  total_attempts: number
  solved: number
  recurring_errors: RecurringError[]
  weak_algorithms: { algorithm: string; failures: number }[]
  strong_algorithms: { algorithm: string; solves: number }[]
  avg_hint_tier: number
  languages: string[]
  summary: string
}

export interface Counterexample {
  args: unknown[]
  student_output: unknown
  reference_output: unknown
  description: string
}

export interface Evidence {
  curated?: { results: LangResult[] } | null
  fuzz?: {
    ran: boolean
    total: number
    passed: number
    note: string
    counterexamples: Counterexample[]
  } | null
  complexity?: {
    ran: boolean
    sizes: number[]
    timings: number[]
    estimate: string
    note: string
  } | null
}
