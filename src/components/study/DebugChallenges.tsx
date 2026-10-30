import { useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { fetchDebugCatalog, nextDebugChallenge, assessDebugChallenge, type DebugCatalog, type DebugChallenge, type DebugDifficulty } from '../../lib/studyApi'
import { UnderstandingFields, useUnderstandingDraft } from './UnderstandingCheck'
import { isDraftText, useLearningDraft, useLearningFeedback, useLearningPauseGuard } from '../../lib/learningSupport'

const SUBJECT_LABELS: Record<string, string> = {
  python: 'Python', javascript: 'JavaScript', java: 'Java', typescript: 'TypeScript',
  c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust', ruby: 'Ruby', html: 'HTML', css: 'CSS',
  'python-fastapi': 'FastAPI (Python)', 'python-django': 'Django (Python)', 'python-flask': 'Flask (Python)',
  'embedded-c': 'Embedded C', 'embedded-python': 'Embedded Python',
  'spring-boot': 'Spring Boot', 'spring-core': 'Spring Core', 'spring-data': 'Spring Data',
  'spring-mvc': 'Spring MVC', 'spring-security': 'Spring Security', 'spring-testing': 'Spring Testing',
  bootstrap: 'Bootstrap', bulma: 'Bulma', tailwind: 'Tailwind CSS', sass: 'Sass', shadcn: 'shadcn/ui',
}
const label = (value: string) => SUBJECT_LABELS[value] ?? value.split('-').map(x => x[0]?.toUpperCase() + x.slice(1)).join(' ')

interface Props {
  language: string
  focusId?: string
  onSelect: (challenge: DebugChallenge | null) => void
}

export function DebugChallenges({ language, focusId, onSelect }: Props) {
  const [catalog, setCatalog] = useState<DebugCatalog | null>(null)
  const [subject, setSubject] = useState(language)
  const [difficulty, setDifficulty] = useState<DebugDifficulty>('easy')
  const [challenge, setChallenge] = useState<DebugChallenge | null>(null)
  const [diagnosis, setDiagnosis] = useLearningDraft(`debug-diagnosis:${language}:${challenge?.attempt_id ?? 'none'}`, '', isDraftText)
  const understanding = useUnderstandingDraft(`debug:${language}:${challenge?.attempt_id ?? 'none'}`)
  const reportLearning = useLearningFeedback()
  const [busy, setBusy] = useState(false)
  useLearningPauseGuard(busy)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const version = useRef(0)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  const loadCatalog = () => focusId ? fetchDebugCatalog(language, focusId) : fetchDebugCatalog(language)

  useEffect(() => {
    const request = ++version.current
    setCatalog(null); setChallenge(null); setSubject(language); setDifficulty('easy')
    setError(null); setLoading(true); setBusy(false)
    selectRef.current(null)
    loadCatalog().then(data => {
      if (request !== version.current) return
      setCatalog(data)
      const first = data.subjects.find(s => s.id === language) ?? data.subjects[0]
      if (!first) return
      setSubject(first.id)
      const initialLevel = first.levels.find(l => l.difficulty === 'easy' && l.total > 0) ?? first.levels.find(l => l.total > 0)
      setDifficulty(initialLevel?.difficulty ?? 'easy')
      const saved = initialLevel?.current ?? null
      setChallenge(saved)
      if (saved) selectRef.current(saved)
    }).catch(e => { if (request === version.current) setError(getApiErrorMessage(e)) })
      .finally(() => { if (request === version.current) setLoading(false) })
    return () => { ++version.current }
  }, [language, focusId])

  const currentSubject = catalog?.subjects.find(s => s.id === subject)
  const level = currentSubject?.levels.find(l => l.difficulty === difficulty)
  const changeScope = (nextSubject: string, nextDifficulty: DebugDifficulty) => {
    ++version.current
    setSubject(nextSubject); setDifficulty(nextDifficulty); setError(null)
    const saved = catalog?.subjects.find(s => s.id === nextSubject)?.levels.find(l => l.difficulty === nextDifficulty)?.current ?? null
    setChallenge(saved); selectRef.current(saved)
  }
  const next = async () => {
    const request = ++version.current
    setBusy(true); setError(null)
    try {
      const item = await (focusId ? nextDebugChallenge(language, subject, difficulty, focusId) : nextDebugChallenge(language, subject, difficulty))
      if (request !== version.current) return
      setChallenge(item); selectRef.current(item)
      const updated = await loadCatalog()
      if (request === version.current) setCatalog(updated)
    } catch (e) {
      if (request === version.current) setError(getApiErrorMessage(e))
    } finally { if (request === version.current) setBusy(false) }
  }
  const review = async () => {
    if (busy || !challenge || diagnosis.trim().length < 10 || !understanding.reasoning.trim() || !understanding.transfer.trim()) return
    const request = ++version.current
    setBusy(true); setError(null)
    try {
      const assessed = await assessDebugChallenge(challenge.attempt_id, diagnosis.trim(), understanding.reasoning, understanding.transfer)
      if (request !== version.current) return
      setChallenge({ ...challenge, status: assessed.status, understanding_result: assessed.understanding })
      reportLearning(assessed.understanding.passed ? 'success' : 'difficulty')
      const updated = await loadCatalog()
      if (request === version.current) setCatalog(updated)
    } catch (e) { if (request === version.current) setError(getApiErrorMessage(e)) }
    finally { if (request === version.current) setBusy(false) }
  }
  const ownCode = () => { setChallenge(null); selectRef.current(null) }

  return <div className="mb-5 rounded-xl border border-[var(--line)] p-4" aria-label="Debugging challenges">
    <h3 className="m-0 mb-2 text-lg font-bold">Debug this topic</h3>
    <p className="text-sm">Trace a snippet, find a defect, or bring your own code for the current topic. Problems you have opened are saved to your account and never silently repeated.</p>
    {catalog?.scope && <p className="my-2 font-semibold" role="status">Current topic: {catalog.scope.title}</p>}
    {loading && <p role="status">Loading debugging problems…</p>}
    {catalog && <>
      <div className="controls my-3">
        <label className="selector"><span className="selector-label">Language or framework</span>
          <select aria-label="Debugging subject" value={subject} disabled={busy} onChange={e => changeScope(e.target.value, difficulty)}>
            {catalog.subjects.map(s => <option key={s.id} value={s.id}>{label(s.id)}</option>)}
          </select></label>
        <label className="selector"><span className="selector-label">Difficulty</span>
          <select aria-label="Debugging difficulty" value={difficulty} disabled={busy} onChange={e => changeScope(subject, e.target.value as DebugDifficulty)}>
            {catalog.difficulties.map(d => <option key={d} value={d}>{label(d)}</option>)}
          </select></label>
      </div>
      <p className="text-sm" role="status">{level?.remaining ?? 0} unseen of {level?.total ?? 0} problems · {level?.reviewed ?? 0} reviewed at this level</p>
      {!catalog.subjects.length && <p>Coming soon — debugging problems for this topic. You can discuss your own relevant code below; unrelated topics will not be substituted.</p>}
      <button type="button" className="primary-btn mt-2" onClick={() => void next()} disabled={busy || !level?.remaining}>
        {busy ? 'Saving…' : challenge ? 'Next unseen problem' : 'Get a debugging problem'}</button>
      {challenge && <button type="button" className="mini-btn ml-2" disabled={busy} onClick={ownCode}>Use my own code</button>}
      {level && level.total === 0 && <p className="mt-2 text-sm">Coming soon — this difficulty for the current topic. Choose another difficulty; unrelated topics will not be substituted.</p>}
      {level && level.total > 0 && level.remaining === 0 && <p className="mt-2 text-sm">You have opened every problem at this level for this topic. Choose another difficulty to continue without repeats.</p>}
    </>}
    {error && <p role="alert" className="error-banner mt-2">{error}</p>}
    {challenge && <article className="mt-4" aria-label="Current debugging problem">
      <p className="island-kicker">{label(challenge.subject)} · {label(challenge.difficulty)}</p>
      <h4 className="font-bold">{challenge.title}</h4>
      <p className="text-xs">{challenge.task_kind === 'trace' ? 'Code investigation: explain the output or state changes; the code may be correct.' : 'Bug investigation: find the cause and propose a correction.'}</p>
      {challenge.code_language !== challenge.language && <p className="text-xs">{label(challenge.code_language)} markup used to reproduce this framework issue.</p>}
      <p className="text-sm">{challenge.failure}</p>
      <pre className="quiz-code my-3 overflow-x-auto rounded-lg p-3"><code>{challenge.code}</code></pre>
      <p className="text-sm">{challenge.goal}</p>
      <p className="cost-note">Diagnosis and follow-up receive rubric feedback. Code is not executed, and no pathway mastery credit is awarded. Embedded scenarios are for simulation and analysis, not hardware execution.</p>
      {challenge.understanding_result && <div role="status" className="quiz-feedback">
        <p>{challenge.understanding_result.passed ? 'Understanding demonstrated.' : 'Keep building on your diagnosis.'} Score: {Math.round(challenge.understanding_result.score * 100)}%</p>
        <p>{challenge.understanding_result.feedback}</p>
      </div>}
      {challenge.status === 'reviewed' ? <p role="status">Diagnosis saved. Choose the next unseen problem or a harder level.</p> : <>
        <label className="selector mt-3 block"><span className="selector-label">Your diagnosis and regression test</span>
          <textarea aria-label="Challenge diagnosis" className="train-textarea" rows={3} maxLength={4000} value={diagnosis} disabled={busy} onChange={e => setDiagnosis(e.target.value)} /></label>
        <UnderstandingFields prompts={challenge.understanding ?? { reasoning: 'Explain the specific cause or state change using this snippet.', transfer: 'Give a concrete regression test: input or setup, expected result, and why it catches this issue.' }} draft={understanding} busy={busy} />
        <button type="button" className="mini-btn mt-2" onClick={() => void review()} disabled={busy || diagnosis.trim().length < 10 || !understanding.reasoning.trim() || !understanding.transfer.trim()}>Check my diagnosis</button>
      </>}
    </article>}
  </div>
}
