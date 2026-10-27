// Practice workspace endpoints: autosaved files, checkpoints, reset, free
// test runs and per-session summaries. See dsa-chatbot-api/app/routers/workspace.py.
import { api } from './api'

// The workspace reports its own errors inline, next to the action that failed.
const SILENT = { silentError: true } as const

export interface WorkspaceFile {
  name: string
  content: string
}

export interface WorkspaceDraft {
  files: WorkspaceFile[]
  entry: string
  template: string
  revision: number | null
  updated_at: string | null
}

export interface WorkspaceTemplate {
  id: string
  title: string
  description: string
}

export interface CheckpointSummary {
  id: string
  kind: 'manual' | 'evaluation' | 'before_reset' | 'before_restore'
  label: string
  entry: string
  created_at: string
  file_names: string[]
}

export interface WorkspaceProgress {
  test_runs: number
  evaluations: number
  attempts: number
  solved: boolean
  hints: number
  highest_hint_tier: number
  reflections: number
  best_result: { passed: number; total: number } | null
  last_activity: string | null
}

export interface RevealPolicy {
  policy: 'after_evaluation' | 'after_pass' | 'disabled'
  min_evaluations: number
  requirement: string
  has_solution: boolean
  available: boolean
}

export interface WorkspaceState {
  problem_id: string
  language: string
  draft: WorkspaceDraft
  templates: WorkspaceTemplate[]
  multi_file: boolean
  checkpoints: CheckpointSummary[]
  progress: WorkspaceProgress
  reveal: RevealPolicy
  limits: { max_files: number; max_total_chars: number; runs_per_hour: number }
}

export interface SourceSpan {
  file: string
  start: number
  end: number
}

export interface Diagnostic {
  phase: 'compile' | 'run' | 'timeout'
  message: string
  file: string | null
  line: number | null
}

export interface TestRun {
  status: 'passed' | 'failed' | 'unverified' | 'error'
  passed: number
  total: number
  cases: { index: number; passed: boolean }[]
  detail: string
  diagnostic: Diagnostic | null
  source_map?: SourceSpan[] | null
}

export interface SessionSummary {
  session_id: string
  problem_id: string
  language: string
  status: string
  started_at: string
  last_activity: string | null
  elapsed_minutes: number
  test_runs: number
  evaluations: { status: string; passed: number; total: number; at: string }[]
  solved: boolean
  hint_tiers: number[]
  reflection: string | null
  error_categories: string[]
}

const enc = encodeURIComponent

export async function openWorkspace(problemId: string, language: string): Promise<WorkspaceState> {
  return (await api.get(`/workspace/${enc(problemId)}`, { params: { language }, ...SILENT })).data
}

export async function saveWorkspace(problemId: string, body: {
  language: string
  files: WorkspaceFile[]
  entry: string
  template: string
  revision: number | null
  force?: boolean
}): Promise<{ revision: number; updated_at: string }> {
  return (await api.put(`/workspace/${enc(problemId)}`, body, SILENT)).data
}

export async function resetWorkspace(problemId: string, language: string, template: string): Promise<WorkspaceDraft> {
  return (await api.post(`/workspace/${enc(problemId)}/reset`, { language, template }, SILENT)).data.draft
}

export async function createCheckpoint(problemId: string, body: {
  language: string
  files: WorkspaceFile[]
  entry: string
  label: string
}): Promise<CheckpointSummary> {
  return (await api.post(`/workspace/${enc(problemId)}/checkpoints`, body, SILENT)).data
}

export async function restoreCheckpoint(problemId: string, checkpointId: string): Promise<WorkspaceDraft> {
  return (await api.post(`/workspace/${enc(problemId)}/checkpoints/${enc(checkpointId)}/restore`, null, SILENT)).data.draft
}

export async function deleteCheckpoint(problemId: string, checkpointId: string): Promise<void> {
  await api.delete(`/workspace/${enc(problemId)}/checkpoints/${enc(checkpointId)}`, SILENT)
}

export async function runWorkspaceTests(problemId: string, body: {
  language: string
  files: WorkspaceFile[]
  entry: string
  practice_session_id?: string
}): Promise<TestRun> {
  return (await api.post(`/workspace/${enc(problemId)}/run`, body, SILENT)).data
}

export async function fetchSessionSummary(sessionId: string): Promise<SessionSummary> {
  return (await api.get(`/practice/sessions/${enc(sessionId)}/summary`, SILENT)).data
}
