import { Link } from '@tanstack/react-router'
import type { PathNode, StudyMode } from '../../lib/studyApi'

export function ExplainPathway({ node, language, previous, onOpen }: {
  node: PathNode; language: string; previous?: PathNode
  onOpen: (mode: StudyMode, focus: string) => void
}) {
  return <section className="island-shell mb-4 rounded-2xl p-4" aria-label="Explain learning pathway">
    <h3 className="m-0 font-bold">Build understanding, then prove it</h3>
    {previous && <p className="text-sm">Builds on: {previous.title}. {previous.complete ? 'Prerequisite checkpoint complete.' : 'Revisit this prerequisite if the current topic feels difficult.'}</p>}
    <ol className="my-3 space-y-2 pl-5 text-sm">
      <li>Read the topic lesson above. Ask the coach for a mental model and a correct worked example.</li>
      <li>Predict an outcome and explain why. Use the topic questions below to reflect; these are ungraded.</li>
      <li>Check understanding: {node.checks_available ? (node.checks_passed ? 'checks passed.' : 'pass at least two thirds of the topic checks.') : 'checks coming soon.'}
        {!!node.checks_available && <button className="mini-btn ml-2" onClick={() => onOpen('quiz', node.id)}>Check understanding</button>}</li>
      <li>Apply it: {node.exercise_id ? (node.exercise_passed ? 'graded exercise passed.' : 'complete the graded exercise.') : 'this module is assessed through its topic checks.'}
        {node.exercise_id && <Link className="mini-btn ml-2" to="/practice" search={{ problem: node.exercise_id, language }}>Apply this topic</Link>}</li>
      <li>Transfer and review: investigate a related bug, then revisit any missed concepts.
        <button className="mini-btn ml-2" onClick={() => onOpen('debug', node.id)}>Debug this concept</button></li>
    </ol>
    <p className="mb-0 text-xs">Reading, chatting and self-reflection do not unlock stages. Mastery uses the recorded assessments and requires complete curriculum content.</p>
  </section>
}
