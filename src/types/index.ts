// Shared TypeScript types used across components and hooks
export type Provider = 'openai' | 'claude' | 'gemini'

export type Role = 'student' | 'teacher' | 'admin'

export type Track = 'language' | 'dsa' | 'algorithm'
export type Mode = 'learn' | 'practice'

export interface User {
  id: string
  email: string
  peppercorns: number
  role: Role
  preferred_language: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ChatResponse {
  answer: string
  thread_id: string
  peppercorns_remaining: number
}

export interface AnalysisResult {
  mistakes: string[]
  enhancements: string[]
  watchouts: string[]
  interview_tips: string[]
  overall_feedback: string
}

export interface AnalyzeResponse {
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
  preferred_language: string
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

// ---------- Knowledge base uploads (/learn) ----------

export type KnowledgeStatus = 'pending' | 'published' | 'rejected'
export type KnowledgeTrack = 'custom' | 'dsa' | 'algorithm' | 'language'

export interface LearnStatus {
  status: string
  supported_formats: string[]
  allowed_tracks: KnowledgeTrack[]
  max_upload_mb: number
  vector_store: string
  embedding_provider: string
  requires_review: boolean
}

export interface LearnTrainResult {
  status: string
  document_id: string
  review_status: KnowledgeStatus
  filename: string
  file_type: string
  characters_extracted: number
  chunks_trained: number
  track: KnowledgeTrack
  message: string
}

export interface KnowledgeDocument {
  id: string
  owner_id: string
  owner_email: string
  filename: string
  file_type: string
  track: KnowledgeTrack
  status: KnowledgeStatus
  characters: number
  chunks: number
  review_note: string
  created_at: string | null
  reviewed_at: string | null
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  preview: string
}
