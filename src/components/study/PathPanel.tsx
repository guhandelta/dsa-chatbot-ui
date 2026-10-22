import { contentGapLabel, hasCurriculumGaps, type PathNode, type StudyPath } from '../../lib/studyApi'

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
  unlockedNodes?: Set<string>
  onFocus: (nodeId: string) => void
}

export function isSectionEnabled(node: PathNode, path: StudyPath, unlockedNodes?: Set<string>): boolean {
  if (unlockedNodes?.has(node.id)) {
    return true
  }
  if (node.complete || node.status === 'complete' || node.status === 'in-progress' || node.id === path.current_id) {
    return true
  }

  if (node.kind === 'stage') {
    const stages = path.nodes.filter((n) => n.kind === 'stage')
    const idx = stages.findIndex((n) => n.id === node.id)
    if (idx <= 0) return true

    // Check if the immediately preceding stage or all prior stages are complete or unlocked
    const prevStage = stages[idx - 1]
    if (unlockedNodes?.has(prevStage.id)) return true
    return prevStage.complete || prevStage.status === 'complete'
  }

  const stages = path.nodes.filter((n) => n.kind === 'stage')
  const allStagesCompleted = stages.length === 0 || stages.every((s) => s.complete || s.status === 'complete' || unlockedNodes?.has(s.id))
  if (allStagesCompleted) return true

  const modules = path.nodes.filter((n) => n.kind === 'module')
  const modIdx = modules.findIndex((n) => n.id === node.id)
  return modIdx === 0
}

export function PathPanel({ path, focusId, unlockedNodes, onFocus }: Props) {
  const gaps = hasCurriculumGaps(path)

  const stages = path.nodes.filter((n) => n.kind === 'stage')
  const modules = path.nodes.filter((n) => n.kind === 'module')
  const item = (node: PathNode) => {
    const enabled = isSectionEnabled(node, path, unlockedNodes)
    return (
      <li key={node.id}>
        <button
          type="button"
          disabled={!enabled}
          aria-disabled={!enabled}
          title={enabled ? undefined : 'Complete previous sections to unlock'}
          onClick={(e) => {
            e.preventDefault()
            if (enabled) onFocus(node.id)
          }}
          aria-current={focusId === node.id}
          className={`item-btn ${focusId === node.id ? 'is-active' : ''} ${
            !enabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
          }`}
        >
          <span className="item-title">
            <span aria-hidden="true">{enabled ? STATUS_MARK[node.status] : '🔒'} </span>
            {node.stage ? `${node.stage}. ` : ''}
            {node.title}
            {node.id === path.current_id ? ' (you are here)' : ''}
            {!enabled && <span className="text-[11px] font-normal text-[var(--sea-ink-soft)]"> (locked)</span>}
          </span>
          <span className="text-xs">
            {node.level}
            <span className="sr-only">, {enabled ? node.status.replace('-', ' ') : 'locked'}</span>
          </span>
        </button>
        {!!node.missing_content?.length && (
          <p className="my-1 text-xs">Missing: {node.missing_content.map(contentGapLabel).join(', ')}.</p>
        )}
      </li>
    )
  }
  return <aside className="island-shell rounded-2xl p-4" aria-label="Your learning path">
    <p className="island-kicker mb-1">{path.label} path</p>
    <p className="m-0 text-sm">{path.completed}/{path.total} nodes mastered</p>
    <p className="mt-1 mb-3 text-xs text-[var(--sea-ink-soft)]">{gaps ? 'Partial curriculum: some lessons or assessments are still missing' : VERDICT[path.readiness.verdict]}. {path.mastery_rule}</p>
    {path.available_total !== undefined && <p className="my-1 text-xs">{path.available_total} nodes with graded work available{path.unavailable_total !== undefined ? `; ${path.unavailable_total} without graded work` : ''}.</p>}
    {(path.readiness.spine_lessons !== undefined || path.readiness.spine_checks !== undefined || path.readiness.depth_assessments !== undefined) && <p className="my-1 text-xs text-[var(--sea-ink-soft)]">
      {path.readiness.spine_lessons !== undefined && `Stage lessons: ${path.readiness.spine_lessons}/${path.readiness.spine_total}. `}
      {path.readiness.spine_checks !== undefined && `Stage checks: ${path.readiness.spine_checks}/${path.readiness.spine_total}. `}
      {path.readiness.depth_assessments !== undefined && `Module assessments: ${path.readiness.depth_assessments}/${path.readiness.depth_total}.`}
    </p>}
    <p className="mb-1 text-xs font-semibold">Shared stages</p>
    <ul className="item-list mb-3">{stages.map(item)}</ul>
    {modules.length > 0 && <>
      <p className="mb-1 text-xs font-semibold">{path.label} depth modules</p>
      <ul className="item-list">{modules.map(item)}</ul>
    </>}
  </aside>
}
