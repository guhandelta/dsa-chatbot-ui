// What next? One recommended step from progress and weak concepts, plus the
// learner's weak spots, their own recent explanations and saved notes.
import { LearningTips } from './LearningTips'
import { ProgressCharts } from './ProgressCharts'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { contentGapLabel, hasCurriculumGaps, fetchStudyPath, fetchInsights, fetchNextStep, fetchStudyNotes, type StudyPath, type Insights, type NextStep, type StudyMode, type StudyNote } from '../../lib/studyApi'

interface Props {
  language: string
  onOpen: (mode: StudyMode, focus: string) => void
}

// The note title already names the concept or question, so show what it adds.
const describe = (note: StudyNote) => note.mode === 'explain'
  ? `Example: ${note.body.example} · Pitfall: ${note.body.pitfall}`
  : note.mode === 'debug' ? `My fix: ${note.body.my_fix}`
    : (note.body.comparison ?? '').split('\n').find((line) => line.startsWith('Watch out:')) ?? 'Side-by-side comparison saved.'

export function NextMode({ language, onOpen }: Props) {
  const [path, setPath] = useState<StudyPath | null>(null)
  const [step, setStep] = useState<NextStep | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setError(null); setStep(null); setPath(null)
    Promise.all([fetchNextStep(language), fetchInsights(language), fetchStudyNotes(language), fetchStudyPath(language, { silent: true }).catch(() => null)])
      .then(([next, seen, saved, curriculum]) => { if (active) { setPath(curriculum); setStep(next); setInsights(seen); setNotes(saved) } })
      .catch((err) => { if (active) setError(getApiErrorMessage(err)) })
    return () => { active = false }
  }, [language])
  if (error) return <><ProgressCharts language={language} /><div className="error-banner" role="alert">{error}</div></>
  if (!step) return <p role="status">Working out your next step…</p>
  const blocked = step.kind === 'content-gap' || step.status === 'blocked'
  const gaps = blocked || (path ? hasCurriculumGaps(path) : false)
  const node = path?.nodes.find((node) => node.id === step.node_id)
  const missing = step.missing_content ?? node?.missing_content ?? path?.readiness.missing_content?.find((gap) => gap.node_id === step.node_id)?.missing ?? []
  const reason = step.reason.replace(/\b[a-z]+(?:_[a-z]+)*\b/g, (word) =>
    word.includes('_') || missing.includes(word) ? contentGapLabel(word) : word)
  const inPage = step.link?.to === '/chat'
  return <div className="flex flex-col gap-4">
    <section className="island-shell rounded-2xl p-4" aria-label="Your learning plan">
      <h2 className="m-0 font-bold">Decide what to do next</h2>
      <p className="mt-2 text-sm">This is your progress dashboard. It recommends one lesson, review quiz, or exercise and explains why, using your completed work and weak spots. Your recent answers and saved notes help you prepare before you open that activity.</p>
    </section>
    <ProgressCharts language={language} />
    <LearningTips guidance={insights?.guidance} onOpen={onOpen} />
    <section className="island-shell rounded-2xl p-4" aria-label="Recommended next step">
      <p className="island-kicker mb-1">Recommended next step</p>
      <h2 className="m-0 text-lg font-bold">{step.kind === 'done' && gaps ? 'Available work finished; curriculum gaps remain' : step.title}</h2>
      <p className="my-2 text-sm">{step.kind === 'done' && gaps ? 'You have finished the available work. More curriculum content is still needed.' : reason}</p>
      {blocked && <p className="my-2 text-sm" role="status">Waiting for missing curriculum content.</p>}
      {gaps && <p className="my-2 text-sm">This curriculum still has missing content. Finishing available work does not complete the full curriculum.</p>}
      {missing.length > 0 && <p className="my-2 text-sm">Missing for this step: {missing.map(contentGapLabel).join(', ')}.</p>}
      {step.kind === 'lesson' && missing.includes('stage_lesson') && <p className="my-2 text-sm">Available fundamentals are a supplement; the stage-specific lesson is still missing.</p>}
      {!blocked && step.link && inPage && <button type="button" className="primary-btn"
        onClick={() => onOpen(step.link!.search.mode as StudyMode, step.link!.search.focus)}>Start</button>}
      {!blocked && step.link && !inPage && <Link to="/practice" search={{ problem: step.link.search.problem, language }} className="primary-btn inline-block">Open in practice</Link>}
    </section>
    {insights && (insights.weak_concepts.length > 0 || insights.responses.length > 0) && <section className="island-shell rounded-2xl p-4" aria-label="How you are thinking">
      <p className="island-kicker mb-2">How you are thinking</p>
      <p className="mb-2 text-xs">This is your quiz history. Earlier misses can remain here after recent improvement; the skill tips above use your latest distinct answers.</p>
      {insights.weak_concepts.length > 0 && <ul className="mb-3">{insights.weak_concepts.map((w) => <li key={w.concept} className="text-sm">
        <strong>{w.concept}</strong>: missed {w.misses} time{w.misses === 1 ? '' : 's'}{w.misconception ? `. Your answers suggest: ${w.misconception}` : ''}
      </li>)}</ul>}
      {insights.responses.slice(0, 3).map((r) => <div key={r.item_id + r.created_at} className="mentor-you mb-2">
        <p className="mb-1 text-xs font-semibold">{r.prompt}</p><p>{r.response}</p>
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
