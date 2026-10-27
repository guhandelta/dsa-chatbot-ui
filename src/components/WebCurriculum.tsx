import { Link } from '@tanstack/react-router'
import { WEB_FUNDAMENTALS, UI_ELECTIVES } from '../lib/webCurriculum'

const KIND_LABEL = { learn: 'Understand', build: 'Build', debug: 'Debug', review: 'Review' } as const

export function WebCurriculum() {
  return <section className="island-shell rounded-2xl p-5" aria-labelledby="web-curriculum-title">
    <p className="island-kicker mb-1">Ordered learning path · framework-independent</p>
    <h2 id="web-curriculum-title" className="ws-heading">Web Fundamentals</h2>
    <p className="max-w-3xl text-sm">Work through browser, HTML, CSS, and JavaScript foundations before choosing a client-side framework or styling system. Each section has focused lessons and a practice battery that mixes understanding, building, debugging, and review.</p>
    <div className="my-4 rounded-xl border border-[var(--line)] p-3 text-sm" role="note">
      <strong>Pathway status:</strong> The curriculum order and section batteries are available. The playground can preview work, but browser challenge evaluation and server-backed section mastery are still being built, so these exercises do not yet unlock later sections or count as completed mastery.
    </div>
    <ol className="space-y-3 pl-5">
      {WEB_FUNDAMENTALS.map((section, index) => <li key={section.id}>
        <details className="rounded-xl border border-[var(--line)] p-3">
          <summary className="cursor-pointer font-semibold">{index}. {section.title}<span className="ml-2 text-xs font-normal text-[var(--sea-ink-soft)]">{section.lessons.length} lesson topics · {section.battery.length} core challenges</span></summary>
          <p className="mt-3 text-sm">{section.outcome}</p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Lesson battery</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{section.lessons.map((lesson) => <li key={lesson.title}><strong>{lesson.title}:</strong> {lesson.focus}</li>)}</ul>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Core challenge battery</h3>
          <ul className="space-y-2 pl-0">{section.battery.map((challenge) => <li key={challenge.id} className="list-none rounded-lg border border-[var(--line)] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">{KIND_LABEL[challenge.kind]}</p>
            <p className="m-0 text-sm"><strong>{challenge.title}.</strong> {challenge.task}</p>
            <Link className="mini-btn mt-2 inline-flex" to="/playground" search={{
              project: `web-${section.id}`, template: 'html-css-js', section: section.id,
              challenge: challenge.id,
            }}>Open challenge in playground</Link>
          </li>)}</ul>
        </details>
      </li>)}
    </ol>
    <section className="mt-5 rounded-xl border border-[var(--line)] p-4" aria-labelledby="ui-electives-title">
      <h3 id="ui-electives-title" className="m-0 text-lg font-semibold">Elective paths after the shared foundations</h3>
      <p className="my-2 text-sm">These are separate specializations; they do not replace the common HTML, CSS, JavaScript, accessibility, and debugging spine.</p>
      <ul className="space-y-2 pl-5 text-sm">{UI_ELECTIVES.map((elective) => <li key={elective.title}><strong>{elective.title}:</strong> {elective.items}<br /><span className="text-[var(--sea-ink-soft)]">Suggested prerequisites: {elective.prerequisite}. Detailed gated lessons and assessments are to be authored.</span></li>)}</ul>
    </section>
  </section>
}

export function ChallengeBrief({ sectionId, challengeId }: { sectionId?: string; challengeId?: string }) {
  if (!sectionId || !challengeId) return null
  const section = WEB_FUNDAMENTALS.find((item) => item.id === sectionId)
  const challenge = section?.battery.find((item) => item.id === challengeId)
  if (!section || !challenge) return null
  return <section className="my-3 rounded-xl border border-[var(--line)] p-4" aria-label="Challenge instructions">
    <p className="island-kicker mb-1">{section.title} · {KIND_LABEL[challenge.kind]}</p>
    <h2 className="ws-heading">{challenge.title}</h2>
    <p className="mb-2 text-sm">{challenge.task}</p>
    <p className="ws-hint">Use the preview and console to explore your work. Challenge criteria and progression are not yet automatically evaluated.</p>
  </section>
}
