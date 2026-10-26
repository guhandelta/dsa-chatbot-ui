// All-time progress on this problem in this language, from recorded events.
import type { WorkspaceProgress } from '../../lib/workspaceApi'

export function ProgressPanel({ progress }: { progress: WorkspaceProgress }) {
  const best = progress.best_result
  return (
    <section className="island-shell rounded-2xl p-5" aria-labelledby="ws-progress-title">
      <h2 id="ws-progress-title" className="ws-heading">Your progress</h2>
      <p className={progress.solved ? 'ev-pass m-0' : 'm-0'}>
        {progress.solved ? 'Solved' : progress.evaluations ? 'Not solved yet' : 'Not evaluated yet'}
      </p>
      <dl className="ws-stats">
        <div><dt>Best result</dt><dd>{best ? `${best.passed}/${best.total} tests` : '—'}</dd></div>
        <div><dt>Test runs</dt><dd>{progress.test_runs}</dd></div>
        <div><dt>Evaluations</dt><dd>{progress.evaluations}</dd></div>
        <div><dt>Hints</dt><dd>{progress.hints ? `${progress.hints} (up to tier ${progress.highest_hint_tier})` : 'None'}</dd></div>
        <div><dt>Reflections</dt><dd>{progress.reflections}</dd></div>
      </dl>
    </section>
  )
}
