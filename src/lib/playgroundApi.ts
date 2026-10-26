// Web playground projects and TypeScript compilation. See dsa-chatbot-api/app/routers/playground.py.
import { api } from './api'
import type { WorkspaceFile } from './workspaceApi'

const SILENT = { silentError: true } as const

export interface PlaygroundProject {
  slug: string
  template: string
  entry: string
  revision: number | null
  updated_at: string | null
  files: WorkspaceFile[]
}

export interface PlaygroundListing {
  projects: { slug: string; template: string; updated_at: string | null }[]
  templates: { id: string; title: string }[]
  limits: { max_files: number; max_total_chars: number; max_projects: number }
}

export interface TsDiagnostic {
  file: string | null
  line: number | null
  column: number | null
  code: string
  message: string
}

export async function listPlayground(): Promise<PlaygroundListing> {
  return (await api.get('/playground', SILENT)).data
}

export async function openPlayground(slug: string, template?: string): Promise<PlaygroundProject> {
  return (await api.get(`/playground/${encodeURIComponent(slug)}`, { params: template ? { template } : {}, ...SILENT })).data
}

export async function savePlayground(slug: string, body: {
  files: WorkspaceFile[]
  template: string
  revision: number | null
  force?: boolean
}): Promise<{ revision: number; updated_at: string }> {
  return (await api.put(`/playground/${encodeURIComponent(slug)}`, body, SILENT)).data
}

export async function transpileTypeScript(files: WorkspaceFile[]): Promise<{ outputs: Record<string, string>; diagnostics: TsDiagnostic[] }> {
  return (await api.post('/playground/transpile', { files }, SILENT)).data
}
