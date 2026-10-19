// The learner's path: the shared 12 stages, then the language's depth
// modules, with mastery status. Choosing a node sets the Study Room focus.
import type { PathNode, StudyPath } from '../../lib/studyApi'

const STATUS_MARK: Record<PathNode['status'], string> = {
  complete: '✓', 'in-progress': '◐', 'not-started': '○', unavailable: '·',
}
const VERDICT: Record<StudyPath['readiness']['verdict'], string> = {
  'launch-ready': 'Full path with graded exercises',
  'quiz-led': 'Quiz-led: no code runner for this language yet',
  'next-wave': 'Lessons and quizzes; graded stage exercises are still being written',
  'needs-authoring': 'Lessons only for now',
}

interface Props {
  path: StudyPath
  focusId: string | null
  onFocus: (nodeId: string) => void
}

export function PathPanel({ path, focusId, onFocus }: Props) {
  const stages = path.nodes.filter((n) => n.kind === 'stage')
  const modules = path.nodes.filter((n) => n.kind === 'module')
  const item = (node: PathNode) => <li key={node.id}>
    <button type="button" onClick={() => onFocus(node.id)} aria-current={focusId === node.id}
      className={`item-btn ${focusId === node.id ? 'is-active' : ''}`}>
      <span className="item-title"><span aria-hidden="true">{STATUS_MARK[node.status]} </span>
        {node.stage ? `${node.stage}. ` : ''}{node.title}{node.id === path.current_id ? ' (you are here)' : ''}</span>
      <span className="text-xs">{node.level}<span className="sr-only">, {node.status.replace('-', ' ')}</span></span>
    </button>
  </li>
  return <aside className="island-shell rounded-2xl p-4" aria-label="Your learning path">
    <p className="island-kicker mb-1">{path.label} path</p>
    <p className="m-0 text-sm">{path.completed}/{path.total} nodes mastered</p>
    <p className="mt-1 mb-3 text-xs text-[var(--sea-ink-soft)]">{VERDICT[path.readiness.verdict]}. {path.mastery_rule}</p>
    <p className="mb-1 text-xs font-semibold">Shared stages</p>
    <ul className="item-list mb-3">{stages.map(item)}</ul>
    {modules.length > 0 && <>
      <p className="mb-1 text-xs font-semibold">{path.label} depth modules</p>
      <ul className="item-list">{modules.map(item)}</ul>
    </>}
  </aside>
}
