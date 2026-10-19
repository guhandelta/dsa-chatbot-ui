// What next? One recommended step from progress and weak concepts, plus the
// learner's weak spots, their own recent explanations and saved notes.
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { fetchInsights, fetchNextStep, fetchStudyNotes, type Insights, type NextStep, type StudyMode, type StudyNote } from '../../lib/studyApi'

interface Props {
  language: string
  onOpen: (mode: StudyMode, focus: string) => void
}

const describe = (note: StudyNote) => note.mode === 'explain'
  ? `${note.body.concept} · Pitfall: ${note.body.pitfall}`
  : note.mode === 'debug' ? `My fix: ${note.body.my_fix}` : `${note.body.first} vs ${note.body.second}: ${note.body.question}`

export function NextMode({ language, onOpen }: Props) {
  const [step, setStep] = useState<NextStep | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([fetchNextStep(language), fetchInsights(language), fetchStudyNotes(language)])
      .then(([next, seen, saved]) => { if (active) { setStep(next); setInsights(seen); setNotes(saved) } })
      .catch((err) => { if (active) setError(getApiErrorMessage(err)) })
    return () => { active = false }
  }, [language])
  if (error) return <div className="error-banner" role="alert">{error}</div>
  if (!step) return <p role="status">Working out your next step…</p>
  const inPage = step.link?.to === '/chat'
  return <div className="flex flex-col gap-4">
    <section className="island-shell rounded-2xl p-4" aria-label="Recommended next step">
      <p className="island-kicker mb-1">Recommended next step</p>
      <h2 className="m-0 text-lg font-bold">{step.title}</h2>
      <p className="my-2 text-sm">{step.reason}</p>
      {step.link && inPage && <button type="button" className="primary-btn"
        onClick={() => onOpen(step.link!.search.mode as StudyMode, step.link!.search.focus)}>Start</button>}
      {step.link && !inPage && <Link to="/practice" search={{ problem: step.link.search.problem }} className="primary-btn inline-block">Open in practice</Link>}
    </section>
    {insights && (insights.weak_concepts.length > 0 || insights.responses.length > 0) && <section className="island-shell rounded-2xl p-4" aria-label="How you are thinking">
      <p className="island-kicker mb-2">How you are thinking</p>
      {insights.weak_concepts.length > 0 && <ul className="mb-3">{insights.weak_concepts.map((w) => <li key={w.concept} className="text-sm">
        <strong>{w.concept}</strong>: missed {w.misses} time{w.misses === 1 ? '' : 's'}{w.misconception ? `. Your answers suggest: ${w.misconception}` : ''}
      </li>)}</ul>}
      {insights.responses.slice(0, 3).map((r) => <div key={r.item_id + r.created_at} className="mentor-you mb-2">
        <span className="mentor-label">{r.prompt}</span><p>{r.response}</p>
        <p className="cost-note">{r.correct ? 'Solid.' : r.feedback}</p>
      </div>)}
    </section>}
    <section className="island-shell rounded-2xl p-4" aria-label="Your notes">
      <p className="island-kicker mb-2">Your notes</p>
      {notes.length === 0 ? <p className="m-0 text-sm">Takeaway cards, logged misconceptions and comparisons will appear here.</p>
        : <ul className="m-0 pl-4">{notes.map((note) => <li key={note.id} className="text-sm"><strong>{note.title}</strong>: {describe(note)}</li>)}</ul>}
    </section>
  </div>
}
