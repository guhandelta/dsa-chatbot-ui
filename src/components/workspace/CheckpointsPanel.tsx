// Named snapshots of the workspace. Restoring or resetting first saves the
// current files as an automatic checkpoint, so both can be undone.
import { useState } from 'react'
import type { CheckpointSummary, WorkspaceTemplate } from '../../lib/workspaceApi'

const KIND: Record<CheckpointSummary['kind'], string> = {
  manual: 'Saved',
  evaluation: 'Evaluated',
  before_reset: 'Automatic',
  before_restore: 'Automatic',
}

interface Props {
  checkpoints: CheckpointSummary[]
  templates: WorkspaceTemplate[]
  template: string
  disabled?: boolean
  onCreate: (label: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReset: (template: string) => Promise<void>
}

export function CheckpointsPanel({ checkpoints, templates, template, disabled, onCreate, onRestore, onDelete, onReset }: Props) {
  const [label, setLabel] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [resetTemplate, setResetTemplate] = useState(template)
  const [resetting, setResetting] = useState(false)
  return (
    <section className="island-shell rounded-2xl p-5" aria-labelledby="ws-checkpoints-title">
      <h2 id="ws-checkpoints-title" className="ws-heading">Checkpoints</h2>
      <form className="ws-row" onSubmit={async (e) => { e.preventDefault(); await onCreate(label.trim()); setLabel('') }}>
        <label className="ws-grow">
          <span className="sr-only">Checkpoint name</span>
          <input value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="Name this version" />
        </label>
        <button type="submit" className="lang-tab" disabled={disabled}>Save checkpoint</button>
      </form>
      {checkpoints.length === 0 ? (
        <p className="ws-hint">No checkpoints yet. Each evaluation also saves one.</p>
      ) : (
        <ul className="ws-list">
          {checkpoints.map((c) => (
            <li key={c.id}>
              <span className="ws-grow">
                <strong>{c.label || 'Checkpoint'}</strong>{' '}
                <span className="ws-hint">{KIND[c.kind]} · <time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time></span>
              </span>
              {confirming === c.id ? (
                <>
                  <button type="button" className="lang-tab" disabled={disabled}
                    onClick={async () => { setConfirming(null); await onRestore(c.id) }}>Confirm restore</button>
                  <button type="button" className="lang-tab" onClick={() => setConfirming(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" className="lang-tab" disabled={disabled}
                    aria-label={`Restore ${c.label || 'checkpoint'}`} onClick={() => setConfirming(c.id)}>Restore</button>
                  <button type="button" className="lang-tab" disabled={disabled}
                    aria-label={`Delete ${c.label || 'checkpoint'}`} onClick={() => void onDelete(c.id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="ws-reset">
        {resetting ? (
          <div role="group" aria-label="Reset workspace">
            <p className="ws-hint m-0">Start again from the starter code. Your current files are saved as a checkpoint first.</p>
            <label className="ws-row">
              <span>Project template</span>
              <select value={resetTemplate} onChange={(e) => setResetTemplate(e.target.value)}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <p className="ws-hint m-0">{templates.find((t) => t.id === resetTemplate)?.description}</p>
            <button type="button" className="lang-tab" disabled={disabled}
              onClick={async () => { setResetting(false); await onReset(resetTemplate) }}>Reset workspace</button>
            <button type="button" className="lang-tab" onClick={() => setResetting(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="lang-tab" disabled={disabled} onClick={() => { setResetTemplate(template); setResetting(true) }}>
            Reset or change template…
          </button>
        )}
      </div>
    </section>
  )
}
