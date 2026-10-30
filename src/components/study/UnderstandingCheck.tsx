import { isDraftText, useLearningDraft } from '../../lib/learningSupport'
import type { UnderstandingPrompts, UnderstandingResult } from '../../lib/studyApi'

export function isUnderstandingPrompts(value: unknown): value is UnderstandingPrompts {
  if (!value || typeof value !== 'object') return false
  const p = value as UnderstandingPrompts
  return typeof p.reasoning === 'string' && typeof p.transfer === 'string'
}

export function isUnderstandingResult(value: unknown): value is UnderstandingResult {
  if (!value || typeof value !== 'object') return false
  const r = value as UnderstandingResult
  return [r.score, r.reasoning_score, r.transfer_score].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
    && typeof r.passed === 'boolean' && typeof r.feedback === 'string' && r.grading === 'rubric-model'
}

export const defaultUnderstanding: UnderstandingPrompts = {
  reasoning: 'Explain one specific step in your answer and why it is valid for this question.',
  transfer: 'Change one input, boundary case, or assumption from this question. State the change, the expected result, and why.',
}

export function useUnderstandingDraft(scope: string) {
  const [reasoning, setReasoning] = useLearningDraft(`reasoning:${scope}`, '', isDraftText)
  const [transfer, setTransfer] = useLearningDraft(`transfer:${scope}`, '', isDraftText)
  return { reasoning, setReasoning, transfer, setTransfer }
}

export function UnderstandingFields({ prompts = defaultUnderstanding, draft, busy }: {
  prompts?: UnderstandingPrompts; draft: ReturnType<typeof useUnderstandingDraft>; busy: boolean
}) {
  return <fieldset disabled={busy} className="mt-3">
    <legend className="font-semibold">Show your understanding</legend>
    <p className="cost-note">Use your own reasoning. An AI rubric evaluates these checks and gives partial credit for what you demonstrate. Writing style is not used to judge AI use.</p>
    <label className="block my-2">{prompts.reasoning}
      <textarea aria-label="Reasoning check" className="train-textarea" rows={3} maxLength={4000}
        value={draft.reasoning} onChange={e => draft.setReasoning(e.target.value)} required /></label>
    <label className="block my-2">{prompts.transfer}
      <textarea aria-label="Follow-up check" className="train-textarea" rows={3} maxLength={4000}
        value={draft.transfer} onChange={e => draft.setTransfer(e.target.value)} required /></label>
  </fieldset>
}
