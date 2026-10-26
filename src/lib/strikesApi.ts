// Learning strikes and extra practice. See dsa-chatbot-api/app/services/learning_strikes.py.
import { api } from './api'

const SILENT = { silentError: true } as const

export type ChallengeFormat = 'mcq' | 'coding' | 'debug'

export interface ChallengeQuestion {
  id: string
  type: 'mcq' | 'mcq_code' | 'write_snippet' | 'fix_bug'
  format: ChallengeFormat
  prompt: string
  concept: string
  code?: string
  choices?: string[]
  starter?: string
  language?: string
  function?: string
  test_count?: number
  answered: boolean
  correct: boolean
}

export interface ChallengeSet {
  id: string
  kind: 'strike' | 'extra'
  node_id: string
  problem_id: string
  required: number
  correct: number
  answered: number
  complete: boolean
  questions: ChallengeQuestion[]
}

export interface StrikeWhere {
  stage: 'evaluation' | 'challenge'
  format: ChallengeFormat
  phase?: 'wrong_answer' | 'compile' | 'run' | 'timeout' | 'review'
  category?: string
  passed?: number
  total?: number
  line?: number | null
  item_id?: string
  concept?: string
}

export interface Strike {
  id: string
  problem_id: string
  node_id: string
  source: 'evaluation' | 'challenge'
  status: 'open' | 'cleared'
  where: StrikeWhere
  created_at: string
  set: ChallengeSet | null
  clearable: boolean
}

export interface StrikeOverview {
  language: string
  cap: number
  cap_action: string
  open: Strike[]
  blocking: boolean
  extra_practice: { remaining_this_month: number; per_month: number; sets: number; correct: number; answered: number }
}

export interface ChallengeResult {
  correct: boolean
  feedback: string
  explanation?: string
  expected?: string
  tests?: { passed: number; total: number }
  cleared: boolean
  new_strike: Strike | null
  replacement: ChallengeQuestion | null
  cap_reached: { action: string; message: string; prerequisite: { id: string; title: string } | null } | null
  // A strike whose topic ran out of questions continues on a new set.
  renewed_set: ChallengeSet | null
  set: ChallengeSet
}

export async function fetchStrikes(language: string): Promise<StrikeOverview> {
  return (await api.get('/strikes', { params: { language }, ...SILENT })).data
}

export async function answerChallenge(setId: string, itemId: string, response: string | number): Promise<ChallengeResult> {
  return (await api.post(`/strikes/sets/${encodeURIComponent(setId)}/answers`, { item_id: itemId, response }, SILENT)).data
}

export async function startExtraPractice(language: string, problemId: string, count = 3): Promise<ChallengeSet> {
  return (await api.post('/strikes/practice', { language, problem_id: problemId, count }, SILENT)).data
}
