// Quiz me: 3-5 server-graded questions for the focused node, one at a time,
// in six formats. Answers never reach the browser until after answering.
import { useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { answerQuiz, startQuiz, type QuizItem, type QuizResult, type QuizStarted } from '../../lib/studyApi'
import { isDraftText, useLearningDraft, useLearningFeedback, useLearningPauseGuard } from '../../lib/learningSupport'
import { UnderstandingFields, useUnderstandingDraft, isUnderstandingPrompts, isUnderstandingResult } from './UnderstandingCheck'

type QuizDraft = { quiz: QuizStarted | null; index: number; result: QuizResult | null; results: QuizResult[] }
function isQuizDraft(value: unknown): value is QuizDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as QuizDraft
  if (!Number.isInteger(d.index) || d.index < 0 || !Array.isArray(d.results) || d.results.length > 5) return false
  const validResult = (r: QuizResult) => r && typeof r.item_id === 'string' && typeof r.correct === 'boolean'
    && (r.understanding === undefined || isUnderstandingResult(r.understanding))
    && typeof r.score === 'number' && Number.isFinite(r.score) && r.score >= 0 && r.score <= 1 && Array.isArray(r.rewards)
    && r.rewards.every(reward => reward && typeof reward.key === 'string' && typeof reward.reason === 'string' && typeof reward.amount === 'number' && typeof reward.balance === 'number')
    && typeof r.feedback === 'string' && typeof r.expected === 'string' && typeof r.explanation === 'string' && typeof r.complete === 'boolean'
    && (r.misconception === undefined || typeof r.misconception === 'string')
    && (!r.tests || (typeof r.tests.status === 'string' && typeof r.tests.passed === 'number' && typeof r.tests.total === 'number'
      && (!r.tests.first_failure || (typeof r.tests.first_failure.case === 'number' && Array.isArray(r.tests.first_failure.args)))))
  if (!d.results.every(validResult) || (d.result !== null && !validResult(d.result))) return false
  if (d.quiz === null) return d.index === 0 && d.result === null && d.results.length === 0
  return !!d.quiz && typeof d.quiz.quiz_id === 'string' && typeof d.quiz.node_title === 'string' && Array.isArray(d.quiz.items) && d.quiz.items.length > 0 && d.quiz.items.length <= 5
    && d.index < d.quiz.items.length && d.quiz.total === d.quiz.items.length && d.quiz.items.every(i => i && typeof i.id === 'string'
      && typeof i.prompt === 'string' && Object.hasOwn(LABELS, i.type)
      && (i.understanding === undefined || isUnderstandingPrompts(i.understanding))
      && typeof i.concept === 'string' && (i.level === null || typeof i.level === 'string')
      && (i.code === undefined || typeof i.code === 'string') && (i.starter === undefined || typeof i.starter === 'string')
      && (i.type !== 'fix_bug' || typeof i.code === 'string') && (i.type !== 'write_snippet' || typeof i.starter === 'string')
      && (!['mcq', 'mcq_code'].includes(i.type) || (Array.isArray(i.choices) && i.choices.every(c => typeof c === 'string'))))
    && d.results.length <= d.quiz.total && d.results.every(result => d.quiz!.items.some(item => item.id === result.item_id))
    && (d.result === null || d.result.item_id === d.quiz.items[d.index].id)
}

const LABELS: Record<QuizItem['type'], string> = {
  mcq: 'Multiple choice', mcq_code: 'Read the code', short_answer: 'Type the output',
  explain: 'Explain in your own words', fix_bug: 'Fix the bug', write_snippet: 'Write the snippet',
}

function initialResponse(item: QuizItem) {
  // The server always sends code for fix_bug and a starter for write_snippet.
  if (item.type === 'fix_bug') return item.code!
  if (item.type === 'write_snippet') return item.starter!
  return ''
}

export function QuizItemView({ item, onAnswer, busy, draftScope = 'standalone' }: { item: QuizItem; busy: boolean; onAnswer: (response: string | number, understanding?: { reasoning: string; transfer: string }) => void; draftScope?: string }) {
  const [response, setResponse] = useLearningDraft(`quiz-answer:${draftScope}:${item.id}`, initialResponse(item), isDraftText)
  const choice = item.type === 'mcq' || item.type === 'mcq_code'
  const understanding = useUnderstandingDraft(`quiz:${draftScope}:${item.id}`)
  const [checkingUnderstanding, setCheckingUnderstanding] = useState(false)
  const complete = choice || (!!understanding.reasoning.trim() && !!understanding.transfer.trim())
  const code = item.type === 'fix_bug' || item.type === 'write_snippet'
  return <form onSubmit={(e) => {
    e.preventDefault()
    if (busy || !response.trim()) return
    if (!choice && !checkingUnderstanding) { setCheckingUnderstanding(true); return }
    if (complete) onAnswer(choice ? Number(response) : response, choice ? undefined : { reasoning: understanding.reasoning, transfer: understanding.transfer })
  }}>
    <p className="island-kicker mb-1">{LABELS[item.type]}{item.level ? ` · ${item.level}` : ''}</p>
    <p className="mb-2 font-semibold">{item.prompt}</p>
    {item.code && !code && <pre className="quiz-code"><code>{item.code}</code></pre>}
    {choice && <fieldset className="quiz-choices"><legend className="sr-only">Choices</legend>
      {item.choices!.map((text, index) => <label key={index} className="quiz-choice">
        <input type="radio" name={item.id} value={index} checked={response === String(index)} onChange={() => setResponse(String(index))} />
        <span className={item.type === 'mcq_code' ? 'font-mono' : ''}>{text}</span>
      </label>)}
    </fieldset>}
    {item.type === 'short_answer' && <input className="quiz-input font-mono" aria-label="Your answer" value={response}
      onChange={(e) => setResponse(e.target.value)} placeholder="Type exactly what it prints" />}
    {item.type === 'explain' && <>
      <textarea className="train-textarea" rows={4} aria-label="Your explanation" value={response} onChange={(e) => setResponse(e.target.value)} />
      <p className="cost-note">Your explanation is saved so the Study Room can see how you are thinking and where you are unsure.</p>
    </>}
    {code && <>
      <textarea className="train-textarea font-mono" rows={10} aria-label="Your code" value={response} onChange={(e) => setResponse(e.target.value)} spellCheck={false} />
      <p className="cost-note">Graded by running {item.test_count} hidden tests on <code>{item.function}</code> in {item.language}.</p>
    </>}
    {checkingUnderstanding && <UnderstandingFields prompts={item.understanding} draft={understanding} busy={busy} />}
    {checkingUnderstanding && <p className="cost-note">Your answer and both checks are evaluated together. Reference answers appear after submission.</p>}
    <button type="submit" className="primary-btn mt-2" disabled={busy || !response.trim() || (checkingUnderstanding && !complete)}>{busy ? 'Checking…' : !choice && !checkingUnderstanding ? 'Continue to understanding check' : 'Check answer'}</button>
  </form>
}

export function QuizFeedback({ result }: { result: QuizResult }) {
  const tests = result.tests
  return <div className={`quiz-feedback ${result.correct ? 'is-correct' : 'is-wrong'}`} role="status">
    <p className="m-0 font-semibold">{result.correct ? 'Correct' : result.score > 0 ? `Partly right (${Math.round(result.score * 100)}%)` : 'Not yet'}</p>
    <p className="my-1">{result.feedback}</p>
    {result.understanding && <p className="my-1 text-sm">Reasoning: {Math.round(result.understanding.reasoning_score * 100)}% · Follow-up: {Math.round(result.understanding.transfer_score * 100)}%. Rubric assessment; this does not establish authorship.</p>}
    {result.misconception && <p className="my-1 text-sm">What your answer suggests: {result.misconception}</p>}
    {tests?.first_failure && <p className="my-1 font-mono text-sm">Test {tests.first_failure.case}: input {JSON.stringify(tests.first_failure.args)} expected {JSON.stringify(tests.first_failure.expected)}, got {JSON.stringify(tests.first_failure.got)}</p>}
    <details className="mt-1"><summary>{result.grading === 'tests' ? 'Reference solution' : 'Model answer'}</summary>
      <pre className="quiz-code"><code>{result.expected}</code></pre>
      {result.explanation && <p className="m-0">{result.explanation}</p>}
    </details>
    {result.grading === 'keywords' && <p className="cost-note">Graded by key ideas because the AI grader was unavailable, so treat this score as approximate.</p>}
  </div>
}

interface Props {
  language: string
  focusId?: string
  onComplete?: () => void
}

export function QuizMode({ language, focusId, onComplete }: Props) {
  const { setBalance } = useAuth()
  const reportLearning = useLearningFeedback()
  const [count, setCount] = useState(4)
  const [snapshot, setSnapshot] = useLearningDraft<QuizDraft>(`quiz:${language}:${focusId ?? 'next'}`,
    { quiz: null, index: 0, result: null, results: [] }, isQuizDraft)
  const { quiz, index, result, results } = snapshot
  const setIndex = (index: number) => setSnapshot(previous => ({ ...previous, index }))
  const setResult = (result: QuizResult | null) => setSnapshot(previous => ({ ...previous, result }))
  const [busy, setBusy] = useState(false)
  useLearningPauseGuard(busy)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setError(null) }, [language, focusId])
  const session = useRef(0)
  useEffect(() => {
    session.current += 1
    setBusy(false)
    return () => { session.current += 1 }
  }, [language, focusId])
  const begin = async () => {
    const requestSession = session.current
    setBusy(true); setError(null)
    try {
      const started = await startQuiz(language, focusId, count)
      if (requestSession !== session.current) return
      setSnapshot({ quiz: started, index: 0, result: null, results: [] })
    } catch (err) {
      if (requestSession === session.current) setError(getApiErrorMessage(err))
    } finally {
      if (requestSession === session.current) setBusy(false)
    }
  }
  const submit = async (response: string | number, understanding?: { reasoning: string; transfer: string }) => {
    const requestSession = session.current
    const current = quiz!  // answers are only possible while a quiz is shown
    setBusy(true); setError(null)
    try {
      const graded = understanding
        ? await answerQuiz(current.quiz_id, current.items[index].id, response, understanding)
        : await answerQuiz(current.quiz_id, current.items[index].id, response)
      if (requestSession !== session.current) return
      setSnapshot(previous => ({ ...previous, result: graded, results: [...previous.results, graded] }))
      reportLearning(graded.correct ? 'success' : 'difficulty')
      // Stage and streak rewards credit peppercorns; keep the header in sync.
      if (graded.rewards.length) setBalance(graded.rewards[graded.rewards.length - 1].balance)
      if (graded.complete) onComplete?.()
    } catch (err) {
      if (requestSession === session.current) setError(getApiErrorMessage(err))
    } finally {
      if (requestSession === session.current) setBusy(false)
    }
  }
  if (!quiz) return <section className="island-shell rounded-2xl p-4">
    <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">A short, mixed-format quiz on what you are learning now: multiple choice, reading code, typing the output, explaining in your own words, fixing a bug and writing a snippet. Quizzes are free.</p>
    <div className="controls">
      <label className="selector"><span className="selector-label">Questions</span>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
      <button type="button" className="primary-btn" onClick={() => void begin()} disabled={busy}>{busy ? 'Preparing…' : 'Start quiz'}</button>
    </div>
    {error && <div className="error-banner mt-3" role="alert">{error}</div>}
  </section>
  const item = quiz.items[index]
  const finished = result?.complete
  const score = results.reduce((sum, r) => sum + r.score, 0)
  const weak = [
    ...new Set(
      results
        .filter((r) => !r.correct)
        .map((r) => quiz.items.find((i) => i.id === r.item_id)?.concept)
        .filter((c): c is string => Boolean(c))
    ),
  ]
  const earned = results.flatMap((r) => r.rewards)
  return <section className="island-shell rounded-2xl p-4">
    <p className="mb-3 text-sm">{quiz.node_title} · question {Math.min(index + 1, quiz.total)} of {quiz.total}</p>
    {!result && <QuizItemView key={item.id} item={item} draftScope={quiz.quiz_id} busy={busy} onAnswer={(r, u) => void submit(r, u)} />}
    {result && <QuizFeedback result={result} />}
    {error && <div className="error-banner mt-3" role="alert">
      <p>{error}</p>
      <p className="text-sm">You can pause and keep this draft, or restart the quiz. Submitted answers stay recorded; an unfinished quiz earns no completion credit.</p>
      <button type="button" className="mini-btn" disabled={busy} onClick={() => void begin()}>Restart quiz</button>
    </div>}
    {result && !finished && <button type="button" className="primary-btn mt-3" onClick={() => { setIndex(index + 1); setResult(null) }}>Next question</button>}
    {finished && <div className="mt-4" aria-label="Quiz summary">
      <h3 className="m-0 text-base font-bold">Score: {Math.round((score / quiz.total) * 100)}% ({results.filter((r) => r.correct).length} of {quiz.total} correct)</h3>
      <p className="my-1 text-sm">{score / quiz.total >= 2 / 3 ? 'Checks mastered for this node.' : 'Score at least two thirds to pass these checks.'}</p>
      {weak.length > 0 && <p className="my-1 text-sm">Concepts to review: {weak.join(', ')}</p>}
      {earned.map((r) => <p key={r.key} className="my-1 text-sm" role="status">+{r.amount} peppercorns: {r.reason === 'earn:stage' ? 'stage completed' : 'streak'}</p>)}
      <button type="button" className="mini-btn mt-2" onClick={() => void begin()}>Another quiz</button>
    </div>}
  </section>
}
