// End-of-session recap built only from what was recorded during the session.
import type { SessionSummary } from '../../lib/workspaceApi'

interface Props {
  summary: SessionSummary
  onRetry: () => void
}

export function SessionSummaryCard({ summary, onRetry }: Props) {
  const last = summary.evaluations[summary.evaluations.length - 1]
  return (
    <section className="island-shell my-4 rounded-2xl p-5" aria-labelledby="ws-summary-title">
      <h2 id="ws-summary-title" className="ws-heading">Session summary</h2>
      <p className={summary.solved ? 'ev-pass' : ''}>
        {summary.solved ? 'You solved it in this session.' : 'Not solved in this session.'}
      </p>
      <dl className="ws-stats">
        <div><dt>Time in session</dt><dd>{Math.max(1, Math.round(summary.elapsed_minutes))} min</dd></div>
        <div><dt>Test runs</dt><dd>{summary.test_runs}</dd></div>
        <div><dt>Evaluations</dt><dd>{summary.evaluations.length}{last ? ` (last: ${last.passed}/${last.total})` : ''}</dd></div>
        <div><dt>Hints</dt><dd>{summary.hint_tiers.length ? summary.hint_tiers.map((t) => `tier ${t}`).join(', ') : 'None'}</dd></div>
        {summary.error_categories.length > 0 && (
          <div><dt>Mistake types seen</dt><dd>{summary.error_categories.map((c) => c.replace(/_/g, ' ')).join(', ')}</dd></div>
        )}
      </dl>
      {summary.reflection && (
        <blockquote className="ws-quote"><strong>Your reflection:</strong> {summary.reflection}</blockquote>
      )}
      <button type="button" className="primary-btn" onClick={onRetry}>Practice again</button>
    </section>
  )
}
