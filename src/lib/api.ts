// Typed API client — all backend calls go through here.
import axios, { AxiosError } from 'axios'
import type {
  AnalyzeResponse,
  AuthResponse,
  ChatResponse,
  ChatProvider,
  Provider,
  Role,
  User,
} from '../types'

// Configured via .env (VITE_API_URL); falls back to local dev default
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const TOKEN_KEY = 'dsa_token'

export const api = axios.create({ baseURL: BASE_URL })

// Attach the JWT to every request when present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 the token is expired, revoked, or forged. Clearing it is not
// enough: the page is already rendered and every subsequent call will fail,
// leaving the user staring at error banners with no way out. Redirect.
//
// The `?expired=1` flag lets /login explain what happened instead of looking
// like a random logout. The guard skips redirecting when we are already on an
// auth page, so a failed login attempt does not reload the form underneath
// the user.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)

      // Some 401s must NOT redirect:
      //   - session restore (/auth/me on load). The landing and about pages
      //     are public; a visitor with a stale token browsing them should
      //     simply appear logged out, not be thrown to a login form.
      //   - the auth pages themselves, or a failed login would reload the
      //     form out from under the user mid-typing.
      const silent = (error.config as { skipAuthRedirect?: boolean } | undefined)
        ?.skipAuthRedirect
      const path = window.location.pathname
      const onAuthPage = path === '/login' || path === '/register'
      const onPublicPage = path === '/' || path === '/about'

      if (!silent && !onAuthPage && !onPublicPage) {
        window.location.href = '/login?expired=1'
      }
    }
    return Promise.reject(error)
  },
)

/** Extracts a human-readable message from an API error. */
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (err.response?.status === 402) return 'Not enough peppercorns for this action.'
    if (err.code === 'ERR_NETWORK') return 'Cannot reach the API — is the backend running on port 8000?'
  }
  return 'Something went wrong. Please try again.'
}

// Keep a key across transport failures; successful/terminal requests retire it.
// The digest includes the signed-in identity without storing its token again.
export async function reliablePost<T>(path: string, body: unknown): Promise<{ data: T }> {
  const bytes = new TextEncoder().encode((localStorage.getItem(TOKEN_KEY) ?? '') + path + JSON.stringify(body))
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((n) => n.toString(16).padStart(2, '0')).join('')
  const slot = 'dsa_request:' + digest
  const key = sessionStorage.getItem(slot) ?? crypto.randomUUID()
  sessionStorage.setItem(slot, key)
  try {
    const result = await api.post<T>(path, body, { headers: { 'Idempotency-Key': key } })
    sessionStorage.removeItem(slot)
    return result
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status !== 409) sessionStorage.removeItem(slot)
    throw error
  }
}

// ---------- Auth ----------

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password })
  return data
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
  return data
}

export async function fetchMe(): Promise<User> {
  // Session restore: a 401 here just means "not logged in", which is a valid
  // state on any public page. Never redirect off the back of it.
  const { data } = await api.get<User>('/auth/me', {
    skipAuthRedirect: true,
  } as never)
  return data
}

// ---------- Chat ----------

export async function sendChatMessage(params: {
  message: string
  threadId?: string
  provider: ChatProvider
  language: string
  track?: string
  focusId?: string
  subject?: string
  retrievalMode?: 'standard' | 'agentic'
}): Promise<ChatResponse> {
  const { data } = await reliablePost<ChatResponse>('/chat/', {
    message: params.message,
    thread_id: params.threadId,
    provider: params.provider,
    language: params.language,
    mode: 'learn',
    track: params.track ?? 'dsa',
    focus_id: params.focusId,
    subject: params.subject,
    retrieval_mode: params.retrievalMode ?? 'standard',
  })
  return data
}

export async function fetchChatCapabilities(): Promise<{ agentic_retrieval: boolean }> {
  return (await api.get('/chat/capabilities')).data
}

// ---------- Analyze ----------

export async function submitSolution(params: {
  problemId: string
  userCode: string
  language: string
  provider: Provider
}): Promise<AnalyzeResponse> {
  const { data } = await reliablePost<AnalyzeResponse>('/analyze/', {
    problem_id: params.problemId,
    user_code: params.userCode,
    language: params.language,
    provider: params.provider,
  })
  return data
}

// ---------- Problems catalog ----------

export async function fetchProblems(): Promise<import('../types').ProblemMeta[]> {
  const { data } = await api.get<import('../types').ProblemMeta[]>('/problems/')
  return data
}


// ---------- Training (teacher/admin) ----------

export async function fetchTrainingStatus(): Promise<import('../types').TrainingStatus> {
  const { data } = await api.get('/training/status')
  return data
}

export async function submitTraining(params: {
  problemId: string
  problem: string
  solutions: Record<string, string>
  provider: Provider
}): Promise<import('../types').TrainResult> {
  const { data } = await api.post('/training/submit', {
    problem_id: params.problemId,
    problem: params.problem,
    solutions: params.solutions,
    provider: params.provider,
  })
  return data
}

export async function deleteTrainedProblem(problemId: string): Promise<void> {
  await api.delete(`/training/problems/${problemId}`)
}

// ---------- Admin ----------

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/admin/users')
  return data
}

export async function setUserRole(userId: string, role: string): Promise<User> {
  const { data } = await api.patch<User>(`/admin/users/${userId}/role`, { role })
  return data
}


// ---------- Tracks ----------

export async function fetchTracks(): Promise<import('../types').TracksResponse> {
  const { data } = await api.get('/tracks/')
  return data
}

export async function fetchTrackItems(
  track: string,
  params: { difficulty?: string; algorithm?: string; language?: string } = {},
): Promise<import('../types').ContentMeta[]> {
  const { data } = await api.get(`/tracks/${track}/items`, { params })
  return data
}

export async function fetchAlgorithmTags(): Promise<string[]> {
  const { data } = await api.get('/tracks/algorithms/tags')
  return data.algorithms
}

export async function fetchAlgorithmPractice(
  algorithm: string, difficulty?: string,
): Promise<import('../types').ContentMeta[]> {
  const { data } = await api.get(`/tracks/algorithms/${algorithm}/practice`, {
    params: difficulty ? { difficulty } : {},
  })
  return data
}

export async function setPreferredLanguage(language: string): Promise<User> {
  const { data } = await api.patch<User>('/auth/me/language', { language })
  return data
}


// ---------- Mentor ----------

export async function askMentor(params: {
  maxHintCost?: number
  problemId: string
  language: string
  reasoning: string
  currentCode?: string
  provider: Provider
}): Promise<import('../types').MentorResponse> {
  const { data } = await reliablePost<import('../types').MentorResponse>('/mentor/ask', {
    max_hint_cost: params.maxHintCost,
    problem_id: params.problemId,
    language: params.language,
    reasoning: params.reasoning,
    current_code: params.currentCode ?? '',
    provider: params.provider,
  })
  return data
}

export async function fetchEntitlement(
  language: string,
): Promise<import('../types').Entitlement> {
  const { data } = await api.get('/mentor/entitlement', { params: { language } })
  return data
}

export async function fetchLearningProfile(): Promise<import('../types').LearningProfileData> {
  const { data } = await api.get('/mentor/profile')
  return data
}

export async function recordReflection(
  problemId: string, reasoning: string, language: string,
): Promise<void> {
  await api.post('/mentor/reflect', null, {
    params: { problem_id: problemId, reasoning, language },
  })
}

export async function deleteLearningProfile(): Promise<void> {
  await api.delete('/mentor/profile')
}

export async function exportLearningProfile(): Promise<unknown> {
  const { data } = await api.get('/mentor/profile/export')
  return data
}

// ---------- Subscriptions ----------

export async function fetchSubscriptions(): Promise<import('../types').Subscription[]> {
  const { data } = await api.get('/subscriptions/')
  return data
}


export async function fetchContentItem(
  contentId: string,
): Promise<{ id: string; markdown: string }> {
  const { data } = await api.get(`/tracks/items/${contentId}`)
  return data
}

// ---------- Knowledge base uploads (teacher/admin) ----------
// Teacher uploads wait for admin approval before chat can retrieve them;
// admin uploads publish immediately. The API enforces both.

export async function fetchLearnStatus(): Promise<import('../types').LearnStatus> {
  const { data } = await api.get('/teach/status')
  return data
}

export async function uploadKnowledge(params: {
  track: import('../types').KnowledgeTrack
  file?: File
  text?: string
  filename?: string
  language?: string
}): Promise<import('../types').LearnTrainResult> {
  if (params.file) {
    const form = new FormData()
    form.append('file', params.file)
    form.append('track', params.track)
    if (params.language) form.append('language', params.language)
    const { data } = await api.post('/teach/train', form)
    return data
  }
  const { data } = await api.post('/teach/train', {
    text: params.text ?? '',
    filename: params.filename || undefined,
    track: params.track,
    ...(params.language ? { language: params.language } : {}),
  })
  return data
}

// ---------- Teach & Knowledge Base Training ----------

export interface LearnTrainResult {
  status: string
  review_status?: 'pending' | 'published' | 'rejected'
  retrieval_status?: string
  reference_language?: string | null
  reference_chunks?: number
  filename: string
  file_type: string
  characters_extracted: number
  chunks_trained: number
  track: string
  message: string
}

export async function trainKnowledgeBaseDocument(params: {
  file?: File
  text?: string
  track?: string
  language?: string
}): Promise<LearnTrainResult> {
  const formData = new FormData()
  if (params.file) {
    formData.append('file', params.file)
  }
  if (params.text) {
    formData.append('text', params.text)
  }
  if (params.track) {
    formData.append('track', params.track)
  }

  if (params.language) formData.append('language', params.language)

  const { data } = await api.post<LearnTrainResult>('/teach/train', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

// Solutions are fetched only after an explicit learner action.
export async function fetchSolutionAccess(problemId: string, language: string): Promise<boolean> {
  const { data } = await api.get(`/problems/${encodeURIComponent(problemId)}/solution-access`, { params: { language } })
  return data.available
}

export async function revealSolution(problemId: string, language: string): Promise<string> {
  const { data } = await api.get(`/problems/${encodeURIComponent(problemId)}/solution`, { params: { language } })
  return data.markdown
}

export async function fetchCurriculumProgress(language: string): Promise<{ completed_ids: string[]; total: number; next_id: string | null }> {
  const { data } = await api.get('/tracks/language/progress', { params: { language } })
  return data
}

export interface PracticeReply {
  session_id: string
  awaiting: 'learner' | 'reflection' | null
  outcome: string
  reply: string
  analysis: import('../types').AnalysisResult | null
  evidence: import('../types').Evidence | null
  solution_available?: boolean
  hint_tier: number
  tier_label: string
  recalled_moment?: string | null
  step_back: import('../types').MentorResponse['step_back_offer']
  peppercorns_remaining: number | null
  current_code?: string
  // Hint pricing: tiers 1-2 are free, tiers 3-4 are charged.
  peppercorns_charged?: number
  next_hint_cost?: number
  // Earn-back peppercorns from a passing evaluation.
  rewards?: { key: string; amount: number; reason: string; balance: number }[]
}
export async function startPractice(problemId: string, language: string, provider: Provider): Promise<PracticeReply> {
  const { data } = await reliablePost<PracticeReply>('/practice/sessions', { problem_id: problemId, language, provider })
  return data
}
export async function fetchPractice(sid: string): Promise<PracticeReply> {
  return (await api.get<PracticeReply>(`/practice/sessions/${encodeURIComponent(sid)}`)).data
}
export async function practiceAction(sid: string, action: 'submit' | 'hint' | 'reflect' | 'quit', code = '', reasoning = '', maxCost?: number): Promise<PracticeReply> {
  const { data } = await reliablePost<PracticeReply>(`/practice/sessions/${encodeURIComponent(sid)}/actions`, { action, code, reasoning, max_hint_cost: maxCost })
  return data
}


export interface ReferenceSubject {
  id: string
  language: string
  records: number
  retrievable_records: number
  status: string
  executable: boolean
}

export async function fetchReferenceSubjects(): Promise<ReferenceSubject[]> {
  return (await api.get('/tracks/reference-subjects')).data.subjects
}


// ---------- Training Registry & Tech Board ----------

export interface TrainingRegistryTechnology {
  id: string
  display_name: string
  category: string
  total_records: number
  retrievable_records: number
  reference_library_records: number
  curriculum_records: number
  authored_catalog_records: number
  status: string
}

export interface TrainingEvent {
  id: string
  timestamp: string
  action: string
  technology: string
  category: string
  source: string
  record_count: number
  vectors_count: number
  status: string
  details: Record<string, unknown>
}

export interface TrainingRegistryResponse {
  status: string
  summary: {
    total_technologies_trained: number
    total_knowledge_records: number
    total_retrievable_chunks: number
    vector_store: {
      backend: string
      vector_count: number
      status: string
      collection_name?: string
      error?: string
    }
    last_trained_at: string | null
    embedding_provider: string
  }
  categories: Record<string, number>
  technologies: TrainingRegistryTechnology[]
  recent_training_events: TrainingEvent[]
}

export async function fetchTrainingRegistry(): Promise<TrainingRegistryResponse> {
  const { data } = await api.get<TrainingRegistryResponse>('/training/registry')
  return data
}

export async function fetchTrainingHistory(limit = 50): Promise<TrainingEvent[]> {
  const { data } = await api.get<TrainingEvent[]>('/training/registry/history', { params: { limit } })
  return data
}

// Role and language guardrails (the server is authoritative).
export interface LanguageAccess {
  role: Role
  languages: string[]
  preferred_language: string | null
  can_train: boolean
  available_languages: string[]
}
export async function fetchLanguageAccess(): Promise<LanguageAccess> {
  return (await api.get('/auth/me/access')).data
}
export async function fetchAdminLanguages(): Promise<string[]> {
  return (await api.get('/admin/languages')).data.languages
}
export interface TeachingAccess extends LanguageAccess { assigned_languages: string[] }
export async function fetchTeachingAccess(userId: string): Promise<TeachingAccess> {
  return (await api.get(`/admin/users/${encodeURIComponent(userId)}/languages`)).data
}
export async function saveTeachingLanguages(userId: string, languages: string[]): Promise<TeachingAccess> {
  return (await api.put(`/admin/users/${encodeURIComponent(userId)}/languages`, { languages })).data
}

export async function fetchKnowledgeDocuments(
  status?: import('../types').KnowledgeStatus,
): Promise<import('../types').KnowledgeDocument[]> {
  const { data } = await api.get('/teach/documents', {
    params: status ? { status } : {},
  })
  return data
}

export async function fetchKnowledgeDocument(
  id: string,
): Promise<import('../types').KnowledgeDocumentDetail> {
  const { data } = await api.get(`/teach/documents/${encodeURIComponent(id)}`)
  return data
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  await api.delete(`/teach/documents/${encodeURIComponent(id)}`)
}

export async function approveKnowledgeDocument(
  id: string,
): Promise<import('../types').KnowledgeDocument> {
  const { data } = await api.post(`/teach/documents/${encodeURIComponent(id)}/approve`)
  return data
}

export async function rejectKnowledgeDocument(
  id: string,
  note = '',
): Promise<import('../types').KnowledgeDocument> {
  const { data } = await api.post(`/teach/documents/${encodeURIComponent(id)}/reject`, { note })
  return data
}
