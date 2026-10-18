import { api, reliablePost, type LanguageAccess } from './api'
import type { User } from '../types'

export interface Page<T> { items: T[]; total: number; offset: number; limit: number }
export interface Overview {
  generated_at: string; days: number; users_by_role: Record<string, number>
  entitled_students: number; active_students: number; pending_documents: number
  oldest_pending_at: string | null; training_needs_review: number; expiring_subscriptions: number
  operations: Record<string, number>; service_failures: number; stuck_operations: number
  cleanup_jobs: number; busy_practice_sessions: number; suspended_users: number; ledger_mismatches: number
  credits_added: number; credits_spent: number; credits_refunded: number; learning_events: Record<string, number>
  trace_sample: { sampled: number; total: number; p95_ms: number | null; estimated_cost_usd: number | null; tokens: number | null; coverage: string }
}
export interface AccountDetail {
  user: User; access: LanguageAccess
  subscriptions: { id: string; language: string; status: string; expires_at: string; source: string }[]
}
export interface LedgerEntry { id: string; user_id: string; email: string; amount: number; balance_after: number; reason: string; created_at: string }
export interface AuditEntry { id: string; actor_email: string; action: string; target_id: string; reason: string; before: Record<string, unknown>; after: Record<string, unknown>; created_at: string }
export interface Operation { id: string; email: string; scope: string; state: string; amount: number; http_status: number; created_at: string }
export interface Document {
  id: string; filename: string; owner_email: string; status: string; track: string
  reference_language: string | null; reference_chunks: number; chunks: number; characters: number
  retrieval_status: string; review_note: string; created_at: string | null; preview?: string
}
export interface Submission { id: string; email: string; problem_id: string; status: string; report: unknown; created_at: string }
export interface SecurityEvent { id: string; user_id: string; severity: string; reasons: string; context: string; counted_as_strike: boolean; code_excerpt: string; created_at: string }
export interface Runtime {
  api_version: string; loaded_at: string; source_fingerprint: string; database: string; migrations: string[]
  execution_backend: string; execution_image: string | null; agentic_enabled: boolean; tracing_enabled: boolean
  providers: { provider: string; model: string; configured: boolean; connectivity: string }[]
  routing_preferences: Record<string, string>; model_timeout_seconds: number; backup_status: string; readiness_note: string
}
export interface RoutingUsage {
  items: { provider: string; model: string; task: string; answers: number; fallbacks: number }[]
  sampled: number; measured: number; total_completed_chats: number; note: string
}
export interface Readiness { artifacts: { name: string; available: boolean; file_updated_at?: string; summary?: unknown }[]; note: string }
export interface TraceSummary { trace_id: string; name: string; status: string; duration_ms: number; total_tokens: number; estimated_cost_usd: number; created_at: string }

export const fetchOverview = async (days: number) => (await api.get<Overview>('/admin/overview', { params: { days } })).data
export const fetchAccounts = async (params: { q?: string; role?: string; status?: string; offset?: number; limit?: number }) =>
  (await api.get<Page<User>>('/admin/accounts', { params })).data
export const fetchAccount = async (id: string) => (await api.get<AccountDetail>(`/admin/accounts/${id}`)).data
export const fetchLedger = async (user_id?: string, offset = 0) => (await api.get<Page<LedgerEntry>>('/admin/ledger', { params: { user_id, offset } })).data
export const giftPeppercorns = async (id: string, amount: number, reason: string) =>
  (await reliablePost<User>(`/admin/users/${id}/gifts`, { amount, reason })).data
export const updateAccountStatus = async (id: string, status: 'active' | 'suspended', reason: string) =>
  (await api.patch<User>(`/admin/accounts/${id}/status`, { status, reason })).data
export const grantLanguageAccess = async (id: string, language: string, days: number, reason: string) => {
  const params = new URLSearchParams({ user_id: id, language, days: String(days), reason })
  return (await reliablePost(`/subscriptions/admin/grant?${params}`, {})).data
}
export const fetchAudit = async (offset = 0) => (await api.get<Page<AuditEntry>>('/admin/audit', { params: { offset } })).data
export const fetchOperations = async (days: number, state?: string, offset = 0) =>
  (await api.get<Page<Operation>>('/admin/operations', { params: { days, state, offset } })).data
export const fetchDocuments = async (status?: string, offset = 0) =>
  (await api.get<Page<Document>>('/admin/documents', { params: { status, offset } })).data
export const fetchDocument = async (id: string) => (await api.get<Document>(`/learn/documents/${id}`)).data
export const reviewDocument = async (id: string, action: 'approve' | 'reject', note: string) =>
  (await api.post<Document>(`/learn/documents/${id}/${action}`, { note })).data
export const fetchSubmissions = async (status?: string, offset = 0) =>
  (await api.get<Page<Submission>>('/admin/submissions', { params: { status, offset } })).data
export const fetchRuntime = async () => (await api.get<Runtime>('/admin/runtime')).data
export const fetchRoutingUsage = async (days: number) => (await api.get<RoutingUsage>('/admin/routing-usage', { params: { days } })).data
export const fetchReadiness = async () => (await api.get<Readiness>('/admin/content-readiness')).data
export const fetchSecurityEvents = async () => (await api.get<SecurityEvent[]>('/admin/security-events', { params: { limit: 100 } })).data
export const fetchTraces = async () => (await api.get<TraceSummary[]>('/admin/traces', { params: { limit: 30 } })).data
export const fetchTrace = async (id: string) => (await api.get<unknown>(`/admin/traces/${id}`)).data
