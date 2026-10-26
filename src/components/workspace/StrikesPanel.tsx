// Learning strikes: what went wrong, and the questions that clear it. Wrong
// answers can add strikes (up to the cap), and learners can ask for extra
// practice on the topic at any time.
import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import {
  answerChallenge, fetchStrikes, startExtraPractice,
  type ChallengeQuestion, type ChallengeResult, type ChallengeSet, type Strike, type StrikeOverview, type StrikeWhere,
} from '../../lib/strikesApi'

const FORMAT_LABEL = { mcq: 'Multiple choice', coding: 'Coding', debug: 'Debugging' } as const

export function describeWhere(where: StrikeWhere): string {
  if (where.stage === 'challenge') {
    return `Missed a ${FORMAT_LABEL[where.format].toLowerCase()} question${where.concept ? ` on ${where.concept.replace(/-/g, ' ')}` : ''}.`
  }
  const tests = where.total ? ` (${where.passed ?? 0}/${where.total} tests passed)` : ''
  const line = where.line ? `, line ${where.line}` : ''
  switch (where.phase) {
    case 'compile': return `The evaluation did not compile${line}.`
    case 'run': return `The code crashed while running the tests${line}${tests}.`
    case 'timeout': return `The code ran past the time limit${tests}.`
    case 'wrong_answer': return `Wrong answers in the evaluation${tests}.`
    default: return 'The evaluation found a mistake.'
  }
}

function Question({ question, disabled, onAnswer }: {
  question: ChallengeQuestion
  disabled: boolean
  onAnswer: (response: string | number) => Promise<void>
}) {
  const [choice, setChoice] = useState<number | null>(null)
  const [code, setCode] = useState(question.starter ?? question.code ?? '')
  const [sending, setSending] = useState(false)
  const name = `q-${question.id}`
  return (
    <form className="ws-question" aria-label={`${FORMAT_LABEL[question.format]} question`} aria-busy={sending}
      onSubmit={async (e) => {
        e.preventDefault()
        setSending(true)
        try { await onAnswer(question.format === 'mcq' ? (choice ?? -1) : code) } finally { setSending(false) }
      }}>
      <p className="m-0"><span className="ws-badge">{FORMAT_LABEL[question.format]}</span> {question.prompt}</p>
      {question.format === 'mcq' && question.code && <pre className="ws-pre">{question.code}</pre>}
      {question.format === 'mcq' ? (
        <fieldset className="ws-choices">
          <legend className="sr-only">Choices</legend>
          {question.choices?.map((text, index) => (
            <label key={index} className="ws-choice">
              <input type="radio" name={name} value={index} checked={choice === index}
                onChange={() => setChoice(index)} disabled={disabled || question.answered} />
              <code>{text}</code>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="ws-code-answer">
          <label>
            <span className="sr-only">Your code</span>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
              rows={Math.min(14, Math.max(5, code.split('\n').length + 1))} disabled={disabled || question.answered} />
          </label>
          {question.function && <span className="ws-hint">Define <code>{question.function}</code>; {question.test_count} tests check it.</span>}
        </div>
      )}
      {question.answered ? (
        <p className={question.correct ? 'ev-pass m-0' : 'ev-fail m-0'}>{question.correct ? 'Correct' : 'Missed'}</p>
      ) : (
        <button type="submit" className="lang-tab" disabled={disabled || (question.format === 'mcq' ? choice === null : !code.trim())}>
          {sending ? (question.format === 'mcq' ? 'Checking…' : 'Running tests…') : 'Submit answer'}
        </button>
      )}
    </form>
  )
}

function SetQuestions({ set, disabled, onAnswer }: {
  set: ChallengeSet
  disabled: boolean
  onAnswer: (set: ChallengeSet, question: ChallengeQuestion, response: string | number) => Promise<void>
}) {
  return (
    <div className="ws-set">
      {set.kind === 'strike' && (
        <p className="ws-hint m-0">{set.correct} of {set.required} correct answers needed.</p>
      )}
      {set.questions.map((q) => (
        <Question key={q.id} question={q} disabled={disabled || set.complete}
          onAnswer={(response) => onAnswer(set, q, response)} />
      ))}
    </div>
  )
}

export function StrikesPanel({ language, problemId, refreshKey }: { language: string; problemId: string; refreshKey: number }) {
  const [overview, setOverview] = useState<StrikeOverview | null>(null)
  const [extra, setExtra] = useState<ChallengeSet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [last, setLast] = useState<ChallengeResult | null>(null)

  const load = useCallback(async () => {
    try {
      setOverview(await fetchStrikes(language))
    } catch {
      setOverview(null)
    }
  }, [language])
  useEffect(() => { void load() }, [load, refreshKey])

  const submit = async (set: ChallengeSet, question: ChallengeQuestion, response: string | number) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      const result = await answerChallenge(set.id, question.id, response)
      setLast(result)
      if (set.kind === 'extra') setExtra(result.set)
      setNotice(result.cleared ? 'Strike cleared.'
        : result.new_strike ? 'That answer earned another strike. A new question was added.'
          : result.cap_reached ? result.cap_reached.message
            : result.correct ? 'Correct.' : 'Not quite.')
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const askForMore = async () => {
    setBusy(true); setError(null)
    try {
      setExtra(await startExtraPractice(language, problemId))
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!overview) return null
  const open: Strike[] = overview.open
  const remaining = overview.extra_practice.remaining_this_month
  return (
    <section className="island-shell rounded-2xl p-5" aria-labelledby="ws-strikes-title">
      <h2 id="ws-strikes-title" className="ws-heading">
        Strikes {open.length > 0 && <span aria-label={`${open.length} of ${overview.cap}`}>({open.length}/{overview.cap})</span>}
      </h2>
      <p className="sr-only" role="status" aria-live="polite">{notice ?? ''}</p>
      {notice && <p className={last?.correct ? 'ev-pass' : 'ev-fail'}>{notice}</p>}
      {last?.cap_reached?.prerequisite && (
        <p className="ws-hint">Earlier lesson to revisit: {last.cap_reached.prerequisite.title}</p>
      )}
      {last && !last.correct && last.explanation && <p className="ws-hint">{last.explanation}</p>}
      {error && <p className="ws-error" role="alert">{error}</p>}
      {open.length === 0 ? (
        <p className="ws-hint m-0">No open strikes. A failed evaluation earns one; free test runs never do.</p>
      ) : (
        <>
          {overview.blocking && <p className="m-0">Clear these to unlock your next challenge.</p>}
          <ol className="ws-strikes">
            {open.map((strike) => (
              <li key={strike.id}>
                <p className="m-0"><strong>{describeWhere(strike.where)}</strong></p>
                {strike.set && strike.clearable ? (
                  <SetQuestions set={strike.set} disabled={busy} onAnswer={submit} />
                ) : (
                  <p className="ws-hint">No questions are authored for this topic yet, so it does not block you.</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="ws-extra">
        <h3 className="ws-heading">Extra practice</h3>
        {extra && !extra.complete ? (
          <SetQuestions set={extra} disabled={busy} onAnswer={submit} />
        ) : (
          <>
            <p className="ws-hint m-0">More questions on this topic, any time. {remaining} of {overview.extra_practice.per_month} sets left this month.</p>
            <button type="button" className="lang-tab" disabled={busy || remaining <= 0} onClick={() => void askForMore()}>
              Practise this topic more
            </button>
          </>
        )}
      </div>
    </section>
  )
}
