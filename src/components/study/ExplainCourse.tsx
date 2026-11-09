import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { fetchExplainPathway, type ExplainCourseData, type ExplainUnit, type StudyMode } from '../../lib/studyApi'

interface Props {
  language: string
  focusId?: string
  onFocus: (focus: string) => void
  onOpen: (mode: StudyMode, focus: string) => void
  assessmentOnly?: boolean
}

function Assessments({ unit, language, onOpen }: { unit: ExplainUnit; language: string; onOpen: Props['onOpen'] }) {
  const assessment = unit.assessment
  return <section className="mt-4 rounded-xl border border-[var(--line)] p-3" aria-label="Linked assessment evidence">
    <h4 className="m-0 font-bold">Check and apply</h4>
    {assessment ? <>
      <p className="text-sm">Linked foundation topic: {assessment.title}. Checks: {assessment.checks_available === 0 ? 'coming soon' : assessment.checks_passed ? 'passed' : 'not passed yet'}. {assessment.exercise_id && `Exercise: ${assessment.exercise_passed ? 'passed' : 'not passed yet'}.`}</p>
      {!assessment.coverage_ready && <p className="text-sm">Some assessment content for this topic is still being built.</p>}
      <div className="flex flex-wrap gap-2">
        {assessment.checks_available > 0 && <button className="mini-btn" onClick={() => onOpen('quiz', assessment.node_id)}>Take linked topic checks</button>}
        {assessment.exercise_id && <Link className="mini-btn" to="/practice" search={{ problem: assessment.exercise_id, language }}>Apply the foundation</Link>}
      </div>
    </> : <p className="text-sm">Dedicated topic assessment: Coming soon. You can study the lesson and discuss the applied task now.</p>}
    <p className="mb-0 text-xs">Reading and discussion are ungraded. Linked checks assess their own foundation topic; they do not certify the whole unit or tier.</p>
  </section>
}

export function ExplainCourse({ language, focusId, onFocus, onOpen, assessmentOnly = false }: Props) {
  const [data, setData] = useState<ExplainCourseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setData(null); setError(null)
    fetchExplainPathway(language).then(value => { if (active) setData(value) })
      .catch(err => { if (active) setError(getApiErrorMessage(err)) })
    return () => { active = false }
  }, [language, retry])
  if (error) return <section className="island-shell mb-4 rounded-2xl p-4" role="alert">
    <p>{error}</p><button className="mini-btn" onClick={() => setRetry(n => n + 1)}>Retry Explain pathway</button>
  </section>
  if (!data) return <p role="status">Loading the tiered Explain pathway…</p>
  const [unitFocus, activityFocus] = focusId?.split('/') ?? []
  const unit = data.units.find(u => u.id === unitFocus)
  const activity = unit?.activities?.find(a => a.id === activityFocus)
  if (assessmentOnly) return unit ? <Assessments unit={unit} language={language} onOpen={onOpen} /> : null
  return <section className="island-shell mb-4 rounded-2xl p-4" aria-label="Tiered Explain pathway">
    <h2 className="m-0 text-lg font-bold">JavaScript: structures to DSA</h2>
    <p className="my-2 text-sm">Choose a topic, learn its structure, reason through an applied problem, then connect it to DSA. This first tiered edition is for JavaScript; other languages need their own curriculum review.</p>
    <details className="my-3">
      <summary className="cursor-pointer text-sm font-semibold">Before these tiers: language foundations</summary>
      <div className="my-2 flex flex-wrap gap-2">{data.foundations.map(foundation => <button key={foundation.id} className="mini-btn" onClick={() => onFocus(foundation.id)}>
        {foundation.title}{foundation.complete ? ' · checkpoint complete' : ' · review foundation'}
      </button>)}</div>
    </details>
    <nav className="grid gap-3" aria-label="Explain tiers and topics">
      {data.tiers.map(tier => <section key={tier.id} className="rounded-xl border border-[var(--line)] p-3">
        <h3 className="m-0 font-bold">Tier {tier.id}: {tier.title}</h3>
        <p className="my-2 text-xs">{tier.description}</p>
        <div className="flex flex-wrap gap-2">{data.units.filter(u => u.tier === tier.id).map(topic => <button key={topic.id} type="button"
          className={`mini-btn ${topic.id === unit?.id ? 'is-active' : ''}`} aria-pressed={topic.id === unit?.id}
          onClick={() => onFocus(topic.id)}>{topic.title}</button>)}</div>
      </section>)}
    </nav>
    {focusId?.startsWith('explain:') && !unit && <p role="alert">This Explain topic is unavailable. Choose a topic above.</p>}
    {unit && activityFocus && !activity && <p role="alert">This activity is unavailable for the selected topic. Choose a practice activity below.</p>}
    {unit && <article className="mt-5" aria-label="Selected Explain topic">
      <p className="island-kicker">Tier {unit.tier} · {unit.title}</p>
      <h3 className="font-bold">{unit.objective}</h3>
      {unit.prerequisite_ids.length > 0 && <div className="my-3 text-sm">Builds on: {unit.prerequisite_ids.map(id => <button key={id} className="mini-btn ml-2" onClick={() => onFocus(id)}>{data.units.find(u => u.id === id)?.title ?? 'Earlier topic'}</button>)}</div>}
      <section aria-label="Structure and operations">
        <h4 className="font-bold">1. Structure and operations</h4>
        <p className="text-sm">{unit.mental_model}</p>
        <pre className="quiz-code overflow-x-auto rounded-lg p-3"><code>{unit.structure.code}</code></pre>
        <p className="text-sm">Worked-example output: <code>{unit.structure.expected_output}</code></p>
        <p className="text-sm"><strong>Watch out:</strong> {unit.pitfall}</p>
      </section>
      <section aria-label="Applied problem">
        <h4 className="font-bold">2. Applied problem</h4>
        <p className="text-sm">{unit.applied_task}</p>
        <p className="text-xs">Ungraded: share your trace, approach or question with the coach below. Explain your reasoning before asking for a hint.</p>
      </section>
      {!!unit.activities?.length && <section className="my-4 rounded-xl border border-[var(--line)] p-3" aria-label="Practice this structure deeply">
        <h4 className="m-0 font-bold">Practice this topic deeply</h4>
        <p className="my-2 text-sm">Core practice builds the foundation. Extensions add another perspective. Review deliberately revisits a skill later. These activities are ungraded; discuss your attempt with the coach below.</p>
        {(['core', 'extension', 'review'] as const).map(route => {
          const activities = unit.activities!.filter(a => a.route === route)
          return activities.length > 0 && <details key={route} open={activity?.route === route || route === 'core'} className="my-2">
            <summary className="cursor-pointer text-sm font-semibold">{route === 'core' ? 'Core practice' : route === 'extension' ? 'Explore further' : 'Return for review'} · {activities.length} activities</summary>
            <div className="my-2 flex flex-wrap gap-2">{activities.map(task => <button key={task.id} type="button" className="mini-btn" aria-pressed={activity?.id === task.id}
              onClick={() => onFocus(`${unit.id}/${task.id}`)}>{task.title}</button>)}</div>
          </details>
        })}
        {activity && <article className="mt-3 rounded-xl border border-[var(--line)] p-3" aria-label="Selected practice activity">
          <p className="island-kicker">{activity.kind} · {activity.route === 'review' ? 'Deliberate review' : activity.route}</p>
          <h5 className="my-2 font-bold">{activity.title}</h5>
          <p className="text-sm">{activity.prompt}</p>
          <ul className="pl-5 text-sm">{activity.checklist.map(check => <li key={check}>{check}</li>)}</ul>
          <p className="mb-0 text-xs">Share your attempt or reasoning with the coach. Opening this activity does not mark it complete or award mastery.</p>
        </article>}
      </section>}
      <section aria-label="DSA connection">
        <h4 className="font-bold">3. DSA connection</h4>
        <p className="text-sm">{unit.dsa_bridge}</p>
        {unit.tier === 3 && <p className="text-xs">Explain guides the reasoning. The linked DSA practice uses the same problem and recorded solve; opening it from another section does not create extra credit.</p>}
        <div className="flex flex-wrap gap-2">{unit.practice.map(problem => <Link key={problem.id} className="mini-btn" to="/practice" search={{ problem: problem.id, language }}>
          {problem.title} · {problem.difficulty}{problem.solved ? ' · solved' : ''}
        </Link>)}</div>
      </section>
      <Assessments unit={unit} language={language} onOpen={onOpen} />
      <button className="mini-btn mt-3" onClick={() => onOpen('debug', unit.id)}>Debug this topic</button>
    </article>}
  </section>
}
