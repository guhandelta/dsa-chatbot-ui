// Typed API client — all backend calls go through here.
import axios, { AxiosError } from 'axios'
import type {
  AnalyzeResponse,
  AuthResponse,
  ChatResponse,
  Provider,
  User,
} from '../types'

// Configured via .env (VITE_API_URL); falls back to local dev default
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const TOKEN_KEY = 'dsa_token'

const api = axios.create({ baseURL: BASE_URL })

// Attach the JWT to every request when present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, drop the stale token; route guards send the user to /login
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
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
  const { data } = await api.get<User>('/auth/me')
  return data
}

// ---------- Chat ----------

export async function sendChatMessage(params: {
  message: string
  threadId?: string
  provider: Provider
  language: string
  track?: string
  focusId?: string
}): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/chat/', {
    message: params.message,
    thread_id: params.threadId,
    provider: params.provider,
    language: params.language,
    mode: 'learn',
    track: params.track ?? 'dsa',
    focus_id: params.focusId,
  })
  return data
}

// ---------- Analyze ----------

export async function submitSolution(params: {
  problemId: string
  userCode: string
  language: string
  provider: Provider
}): Promise<AnalyzeResponse> {
  const { data } = await api.post<AnalyzeResponse>('/analyze/', {
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
  problemId: string
  language: string
  reasoning: string
  currentCode?: string
  provider: Provider
}): Promise<import('../types').MentorResponse> {
  const { data } = await api.post('/mentor/ask', {
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
