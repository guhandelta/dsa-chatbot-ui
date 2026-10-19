// The focused node: learn first (lesson), then practise (graded exercise and
// problems at the node's level).
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { getApiErrorMessage } from '../../lib/api'
import { fetchNodeLesson, type PathNode } from '../../lib/studyApi'

export function NodeCard({ node, language, levelLabel }: { node: PathNode; language: string; levelLabel?: string }) {
  const [lesson, setLesson] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const toggleLesson = async () => {
    if (lesson !== null) { setLesson(null); return }
    setLoading(true); setError(null)
    try {
      setLesson((await fetchNodeLesson(node.id, language)).markdown || 'This lesson has no text yet.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  const checks = node.check_score === null ? 'not taken' : `${Math.round(node.check_score * 100)}%`
  return <section className="island-shell mb-4 rounded-2xl p-4" aria-label="Current focus">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="island-kicker mb-1">{node.stage ? `Stage ${node.stage}` : 'Depth module'} · {node.level}{levelLabel ? ` · ${levelLabel}` : ''}</p>
        <h2 className="m-0 text-lg font-bold">{node.title}</h2>
      </div>
      <span className="tier-chip">{node.status.replace('-', ' ')}</span>
    </div>
    <p className="my-2 text-sm text-[var(--sea-ink-soft)]">
      {node.exercise_id ? `Graded exercise: ${node.exercise_passed ? 'passed' : 'not passed yet'}. ` : ''}
      {node.checks_available ? `Checks: ${checks} (${node.checks_available} questions in the pool).` : 'No checks for this node yet.'}
    </p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="mini-btn" onClick={() => void toggleLesson()} disabled={loading || !node.lesson_ids.length}>
        {loading ? 'Loading…' : lesson !== null ? 'Hide lesson' : '1. Learn: read the lesson'}
      </button>
      {node.exercise_id && <Link to="/practice" search={{ problem: node.exercise_id }} className="mini-btn">2. Practise: graded exercise</Link>}
    </div>
    {error && <div className="error-banner mt-3" role="alert">{error}</div>}
    {lesson !== null && <div className="prose prose-sm mt-3 max-w-none dark:prose-invert"><ReactMarkdown>{lesson}</ReactMarkdown></div>}
    {(node.practice.length > 0 || node.planned_problems.length > 0) && <div className="mt-3">
      <p className="mb-1 text-xs font-semibold">Problems at this level</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {node.practice.map((p) => <li key={p.id}>
          <Link to="/practice" search={{ problem: p.id }} className="mini-btn">{p.title} · {p.difficulty}{p.role === 'stretch' ? ' · stretch' : ''}</Link>
        </li>)}
        {node.planned_problems.map((p) => <li key={p} className="mini-btn opacity-60">{p} · coming soon</li>)}
      </ul>
    </div>}
  </section>
}
