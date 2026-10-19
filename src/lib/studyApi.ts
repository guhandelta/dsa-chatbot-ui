// Study Room API client: the learning path, coaching modes, quizzes and notes.
import { api, reliablePost } from './api'
import type { ChatProvider } from '../types'

export type StudyMode = 'explain' | 'quiz' | 'debug' | 'compare' | 'next' | 'chat'
export type MessageMode = 'explain' | 'debug' | 'compare'
export type QuizType = 'mcq' | 'mcq_code' | 'short_answer' | 'explain' | 'fix_bug' | 'write_snippet'

export interface PracticeProblem { id: string; title: string; difficulty: string; role: 'apply' | 'stretch' }

export interface PathNode {
  id: string
  kind: 'stage' | 'module'
  stage: number | null
  order: number
  slug: string
  title: string
  level: string
  exercise_id: string | null
  lesson_ids: string[]
  practice: PracticeProblem[]
  planned_problems: string[]
  checks_available: number
  available: boolean
  exercise_passed: boolean
  check_score: number | null
  checks_passed: boolean
  complete: boolean
  status: 'complete' | 'in-progress' | 'not-started' | 'unavailable'
}

export interface Readiness {
  language: string
  label: string
  spine_stages: number
  spine_total: number
  depth_lessons: number
  depth_total: number
  quiz_items: number
  runner: boolean
  verdict: 'launch-ready' | 'quiz-led' | 'next-wave' | 'needs-authoring'
}

export interface StudyPath {
  language: string
  label: string
  nodes: PathNode[]
  current_id: string | null
  completed: number
  total: number
  completed_stages: number[]
  mastery_rule: string
  readiness: Readiness
  levels: Record<string, string>
}

export interface Allowance { daily_free: number; used_today: number; free_left: number; cost_after_free: number }

export interface Takeaway { concept: string; example: string; pitfall: string }

export interface StudyReply {
  answer: string
  thread_id: string
  mode: MessageMode
  focus: { kind: 'node' | 'problem' | 'language'; id: string | null; title: string; auto: boolean }
  note_id: string | null
  peppercorns_charged: number
  peppercorns_remaining: number
  allowance: Allowance
  takeaway?: Takeaway
  hint_tier?: number
  tier_label?: string
}

export interface QuizItem {
  id: string
  type: QuizType
  prompt: string
  concept: string
  source: 'authored' | 'knowledge-base'
  level: string | null
  code?: string
  choices?: string[]
  starter?: string
  language?: string
  function?: string
  test_count?: number
}

export interface QuizStarted { quiz_id: string; node_id: string; node_title: string; items: QuizItem[]; total: number }

export interface Reward { key: string; amount: number; reason: string; balance: number }

export interface QuizResult {
  item_id: string
  correct: boolean
  score: number
  grading: 'choice' | 'exact' | 'keywords' | 'rubric-model' | 'tests'
  feedback: string
  expected: string
  explanation: string
  misconception?: string
  tests?: {
    status: string
    passed: number
    total: number
    first_failure: { case: number; args: unknown[]; expected: unknown; got: unknown; detail: string } | null
  }
  answered: number
  total: number
  complete: boolean
  rewards: Reward[]
}

export interface QuizSummary {
  quiz_id: string
  node_id: string
  total: number
  answered: number
  correct: number
  score: number
  complete: boolean
  mastered: boolean
  weak_concepts: string[]
}

export interface NextStep {
  kind: 'quiz' | 'exercise' | 'problem' | 'lesson' | 'done'
  id: string | null
  title: string
  reason: string
  node_id: string | null
  link: { to: string; search: Record<string, string> } | null
}

export interface StudyNote {
  id: string
  language: string
  node_id: string | null
  mode: MessageMode
  title: string
  body: Record<string, string>
  created_at: string
}

export interface Insights {
  weak_concepts: { concept: string; misses: number; correct: number; misconception: string }[]
  responses: { item_id: string; prompt: string; response: string; correct: boolean; score: number; feedback: string; misconception: string; created_at: string }[]
}

export async function fetchStudyPath(language: string): Promise<StudyPath> {
  return (await api.get<StudyPath>('/study/path', { params: { language } })).data
}

export async function fetchNodeLesson(nodeId: string, language: string): Promise<{ markdown: string }> {
  return (await api.get(`/study/nodes/${encodeURIComponent(nodeId)}/lesson`, { params: { language } })).data
}

export async function fetchAllowance(): Promise<Allowance> {
  return (await api.get<Allowance>('/study/allowance')).data
}

export async function sendStudyMessage(params: {
  language: string
  mode: MessageMode
  message: string
  threadId?: string
  focusId?: string
  compareLanguage?: string
  code?: string
  error?: string
  provider: ChatProvider
}): Promise<StudyReply> {
  const { data } = await reliablePost<StudyReply>('/study/message', {
    language: params.language,
    mode: params.mode,
    message: params.message,
    thread_id: params.threadId,
    focus_id: params.focusId,
    compare_language: params.compareLanguage,
    code: params.code ?? '',
    error: params.error ?? '',
    provider: params.provider,
  })
  return data
}

export async function resolveDebug(threadId: string, fix: string): Promise<StudyNote> {
  return (await api.post<StudyNote>('/study/debug/resolve', { thread_id: threadId, fix })).data
}

export async function startQuiz(language: string, nodeId: string | undefined, count: number): Promise<QuizStarted> {
  return (await api.post<QuizStarted>('/study/quiz', { language, node_id: nodeId, count })).data
}

export async function answerQuiz(quizId: string, itemId: string, response: string | number): Promise<QuizResult> {
  return (await api.post<QuizResult>(`/study/quiz/${encodeURIComponent(quizId)}/answer`, { item_id: itemId, response })).data
}

export async function fetchQuizSummary(quizId: string): Promise<QuizSummary> {
  return (await api.get<QuizSummary>(`/study/quiz/${encodeURIComponent(quizId)}`)).data
}

export async function fetchNextStep(language: string): Promise<NextStep> {
  return (await api.get<NextStep>('/study/next', { params: { language } })).data
}

export async function fetchStudyNotes(language: string): Promise<StudyNote[]> {
  return (await api.get<{ notes: StudyNote[] }>('/study/notes', { params: { language } })).data.notes
}

export async function fetchInsights(language: string): Promise<Insights> {
  return (await api.get<Insights>('/study/insights', { params: { language } })).data
}

export async function fetchNextHint(problemId: string, language: string): Promise<{ tier: number; tier_label: string; cost: number; free_tiers: number; max_tier: number }> {
  return (await api.get('/mentor/next-hint', { params: { problem_id: problemId, language } })).data
}
