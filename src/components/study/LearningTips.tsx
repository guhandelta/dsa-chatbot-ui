import type { LearningGuidance, LearningTip, StudyMode } from '../../lib/studyApi'

export function LearningTips({ guidance, onOpen }: {
  guidance?: LearningGuidance
  onOpen: (mode: StudyMode, focus: string) => void
}) {
  const tip = (value: LearningTip, index: number) => <article key={`${value.title}:${index}`} className="mb-3">
    <h3 className="mb-1 text-sm font-bold">{value.title}</h3>
    <p className="my-1 text-xs">{value.evidence}</p>
    <p className="my-2 text-sm">{value.tip}</p>
    {value.action && <button className="mini-btn" onClick={() => onOpen(value.action!.mode, value.action!.focus)}>{value.action.label}</button>}
  </article>
  return <>
    <section className="island-shell rounded-2xl p-4" aria-label="Focus and hone your skills">
      <h2 className="m-0 mb-3 text-lg font-bold">Focus and hone your skills</h2>
      {guidance?.focus.length ? guidance.focus.map(tip) : <p className="text-sm">Complete the current topic checks to establish a baseline. Trace a small example and a boundary case before moving on.</p>}
    </section>
    <section className="island-shell rounded-2xl p-4" aria-label="Build on your strengths">
      <h2 className="m-0 mb-3 text-lg font-bold">Build on your strengths</h2>
      {guidance?.strengths.length ? guidance.strengths.map(tip) : <p className="text-sm">{guidance?.strengths_empty ?? 'There is not enough assessment evidence yet to recommend a strength-based extension.'}</p>}
      <p className="mb-0 text-xs">{guidance?.evidence_note ?? 'Suggestions use recorded assessments. Chat activity and self-reviewed debugging do not establish mastery.'}</p>
    </section>
  </>
}
