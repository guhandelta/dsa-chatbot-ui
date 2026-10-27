import { Link } from '@tanstack/react-router'
import { WEB_FUNDAMENTALS, UI_ELECTIVES, webChallengeProjectSlug } from '../lib/webCurriculum'

const KIND_LABEL = { learn: 'Understand', build: 'Build', debug: 'Debug', review: 'Review' } as const
const authoredLessonCount = WEB_FUNDAMENTALS.flatMap((section) => section.lessons)
  .filter((lesson) => lesson.teaching).length

export function WebCurriculum() {
  return <section className="island-shell rounded-2xl p-5" aria-labelledby="web-curriculum-title">
    <p className="island-kicker mb-1">Ordered learning path · framework-independent</p>
    <h2 id="web-curriculum-title" className="ws-heading">Web Fundamentals</h2>
    <p className="max-w-3xl text-sm">Work through browser, HTML, CSS, and JavaScript foundations before choosing a client-side framework or styling system. Each section has focused lessons and a practice battery that mixes understanding, building, debugging, and review.</p>
    <div className="my-4 rounded-xl border border-[var(--line)] p-3 text-sm" role="note">
      <strong>Pathway status:</strong> The curriculum order and section batteries are available. The playground can preview work, but browser challenge evaluation and server-backed section mastery are still being built, so these exercises do not yet unlock later sections or count as completed mastery.
      <p className="mb-0 mt-2">Detailed study material is authored for {authoredLessonCount} of {WEB_FUNDAMENTALS.reduce((total, section) => total + section.lessons.length, 0)} lesson topics so far.</p>
    </div>
    <ol className="space-y-3 pl-5">
      {WEB_FUNDAMENTALS.map((section, index) => <li key={section.id}>
        <details className="rounded-xl border border-[var(--line)] p-3">
          <summary className="cursor-pointer font-semibold">{index}. {section.title}<span className="ml-2 text-xs font-normal text-[var(--sea-ink-soft)]">{section.lessons.length} lesson topics · {section.battery.length} core challenges</span></summary>
          <p className="mt-3 text-sm">{section.outcome}</p>
          <p className="text-xs text-[var(--sea-ink-soft)]">{section.lessons.filter((lesson) => lesson.teaching).length} of {section.lessons.length} lesson topics have detailed study material.</p>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Lesson battery</h3>
          <ul className="list-disc space-y-3 pl-5 text-sm">{section.lessons.map((lesson) => <li key={lesson.title}>
            <strong>{lesson.title}:</strong> {lesson.focus}
            {lesson.teaching && <details className="mt-2 rounded-lg border border-[var(--line)] p-3">
              <summary className="cursor-pointer font-medium">Study {lesson.title}</summary>
              <h4 className="mb-1 mt-3 font-semibold">Learning objectives</h4>
              <ul className="list-disc space-y-1 pl-5">{lesson.teaching.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
              {lesson.teaching.explanation.map((paragraph) => <p key={paragraph} className="my-3">{paragraph}</p>)}
              <h4 className="mb-1 mt-3 font-semibold">Worked example</h4>
              <pre className="overflow-x-auto rounded-lg bg-[var(--bg-base)] p-3 text-xs"><code>{lesson.teaching.example.code}</code></pre>
              <ol className="my-2 list-decimal space-y-1 pl-5">{lesson.teaching.example.walkthrough.map((step) => <li key={step}>{step}</li>)}</ol>
              <h4 className="mb-1 mt-3 font-semibold">Common misconceptions</h4>
              <ul className="list-disc space-y-1 pl-5">{lesson.teaching.misconceptions.map((item) => <li key={item}>{item}</li>)}</ul>
              <section className="mt-3 rounded-lg border border-[var(--line)] p-3" aria-label={`${lesson.title} knowledge check`}>
                <h4 className="m-0 font-semibold">Quick check</h4>
                <p>{lesson.teaching.check.prompt}</p>
                <details className="rounded border border-[var(--line)] p-2">
                  <summary className="cursor-pointer">Reveal answer: {lesson.title}</summary>
                  <p className="mb-1 mt-2">{lesson.teaching.check.answer}</p>
                  <p className="m-0 text-[var(--sea-ink-soft)]">{lesson.teaching.check.explanation}</p>
                </details>
              </section>
            </details>}
          </li>)}</ul>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Core challenge battery</h3>
          <ul className="space-y-2 pl-0">{section.battery.map((challenge) => <li key={challenge.id} className="list-none rounded-lg border border-[var(--line)] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">{KIND_LABEL[challenge.kind]}</p>
            <p className="m-0 text-sm"><strong>{challenge.title}.</strong> {challenge.task}</p>
            <Link className="mini-btn mt-2 inline-flex" to="/playground" search={{
              project: webChallengeProjectSlug(section.id, challenge.id), template: 'html-css-js', section: section.id,
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

export function ChallengeBrief({ sectionId, challengeId, onResetStarter }: {
  sectionId?: string
  challengeId?: string
  onResetStarter?: () => void
}) {
  if (!sectionId || !challengeId) return null
  const section = WEB_FUNDAMENTALS.find((item) => item.id === sectionId)
  const challenge = section?.battery.find((item) => item.id === challengeId)
  if (!section || !challenge) return null
  return <section className="my-3 rounded-xl border border-[var(--line)] p-4" aria-label="Challenge instructions">
    <p className="island-kicker mb-1">{section.title} · {KIND_LABEL[challenge.kind]}</p>
    <h2 className="ws-heading">{challenge.title}</h2>
    <p className="mb-2 text-sm">{challenge.task}</p>
    {challenge.starterFiles && onResetStarter && (
      <button type="button" className="mini-btn my-2" onClick={onResetStarter}>Reset to starter project</button>
    )}
    <p className="ws-hint">Use the preview and console to explore your work. Challenge criteria and progression are not yet automatically evaluated.</p>
  </section>
}
