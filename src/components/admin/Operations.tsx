import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOperations, fetchRuntime, fetchSecurityEvents, fetchTrace, fetchTraces, type Overview } from '../../lib/adminApi'
import { Empty, JsonDetail, Pager, Panel, Pill, QueryNotice, Table, date, label, number } from './shared'

export function Operations({ days, overview, managePeople }: { days: number; overview?: Overview; managePeople: () => void }) {
  const [mode, setMode] = useState('requests')
  const runtime = useQuery({ queryKey: ['admin', 'runtime'], queryFn: fetchRuntime })
  return <>
    <div className="ad-two-col"><Panel title="Runtime identity" description="Identify the API actually serving this workspace."><QueryNotice query={runtime} />{runtime.data && !runtime.isError && <><dl className="ad-facts"><div><dt>Database</dt><dd><Pill value={runtime.data.database} /></dd></div><div><dt>API version / source</dt><dd>{runtime.data.api_version} · <code>{runtime.data.source_fingerprint}</code></dd></div><div><dt>API module loaded</dt><dd>{date(runtime.data.loaded_at)}</dd></div><div><dt>Schema revision</dt><dd>{runtime.data.migrations.join(', ')}</dd></div><div><dt>Code execution</dt><dd>{runtime.data.execution_backend}</dd></div><div><dt>Backup status</dt><dd>{runtime.data.backup_status}</dd></div></dl><p className="ad-note">{runtime.data.readiness_note}</p>{runtime.data.execution_backend === 'subprocess' && <p className="ad-warning">Host subprocess execution is intended for trusted local development. A container configuration needs its own validation before accepting untrusted production code.</p>}</>}</Panel>
      <Panel title="Recovery & housekeeping" description="Current durable work, across all dates."><dl className="ad-facts"><div><dt>Expired running operations</dt><dd>{overview ? number(overview.stuck_operations) : 'Not measured'}</dd></div><div><dt>Queued vector cleanup jobs</dt><dd>{overview ? number(overview.cleanup_jobs) : 'Not measured'}</dd></div><div><dt>Busy practice sessions</dt><dd>{overview ? number(overview.busy_practice_sessions) : 'Not measured'}</dd></div><div><dt>Suspended accounts</dt><dd>{overview ? number(overview.suspended_users) : 'Not measured'}</dd></div></dl><p className="ad-note">Housekeeping is scheduled every 60 seconds while the API runs. Its last successful pass is not currently recorded. Unsettled reservations older than 30 minutes are eligible for automatic recovery.</p><button type="button" className="ad-text-button" onClick={managePeople}>Manage account status →</button></Panel></div>
    <div className="ad-segments" aria-label="Operations views">{[['requests', 'Service operations'], ['security', 'Security events'], ['traces', 'Request traces']].map(([value, name]) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{name}</button>)}</div>
    {mode === 'requests' ? <OperationList days={days} /> : mode === 'security' ? <Security /> : <Traces />}
  </>
}

function OperationList({ days }: { days: number }) {
  const [state, setState] = useState('failed')
  const [offset, setOffset] = useState(0)
  const query = useQuery({ queryKey: ['admin', 'operations', days, state, offset], queryFn: () => fetchOperations(days, state || undefined, offset) })
  return <Panel title="Service operation receipts" description={`Last ${days} days · idempotent retries share one operation receipt.`}><label>Operation status<select value={state} onChange={e => { setState(e.target.value); setOffset(0) }}><option value="">All statuses</option><option value="failed">Failed</option><option value="running">Running</option><option value="completed">Completed</option></select></label><QueryNotice query={query} />{query.data && !query.isError && <><Table headers={['Account', 'Operation', 'State', 'Reserved credits', 'HTTP status', 'Created']}>
    {query.data.items.map(o => <tr key={o.id}><td>{o.email}</td><td><strong>{label(o.scope)}</strong><small title={o.id}>{o.id.slice(0, 12)}…</small></td><td><Pill value={o.state} /></td><td>{o.amount}</td><td>{o.state === 'running' ? 'Pending' : o.http_status}</td><td className="ad-date">{date(o.created_at)}</td></tr>)}
  </Table>{!query.data.items.length && <Empty>No operations match this status and period.</Empty>}<Pager page={query.data} setOffset={setOffset} /></>}<p className="ad-note">The recorded amount is the original reservation, not an outstanding balance. Check the transaction ledger to confirm a refund.</p></Panel>
}

function Security() {
  const query = useQuery({ queryKey: ['admin', 'security'], queryFn: fetchSecurityEvents })
  return <Panel title="Security event review" description="Latest 100 blocked submission events across all dates. Review evidence before changing an account's status."><QueryNotice query={query} />{query.data && !query.isError && <><Table headers={['User ID', 'Severity', 'Evidence', 'Strike counted', 'Recorded']}>
    {query.data.map(e => <tr key={e.id}><td><code>{e.user_id}</code></td><td><Pill value={e.severity} /></td><td><span>{typeof e.reasons === 'string' ? e.reasons : JSON.stringify(e.reasons)}</span><JsonDetail title="Event evidence" data={{ context: e.context, code_excerpt: e.code_excerpt }} /></td><td>{e.counted_as_strike ? 'Yes' : 'No'}</td><td className="ad-date">{date(e.created_at)}</td></tr>)}
  </Table>{!query.data.length && <Empty>No security events recorded.</Empty>}</>}</Panel>
}

function Traces() {
  const query = useQuery({ queryKey: ['admin', 'traces'], queryFn: fetchTraces })
  const [selected, setSelected] = useState<string | null>(null)
  const detail = useQuery({ queryKey: ['admin', 'trace', selected], queryFn: () => fetchTrace(selected!), enabled: !!selected })
  return <Panel title="Recent traces" description="Latest 30 persisted traces across all dates. Trace coverage is currently limited to instrumented flows."><QueryNotice query={query} />{query.data && !query.isError && <><Table headers={['Operation', 'Status', 'Duration', 'Tokens', 'Estimated USD', '']}>
    {query.data.map(t => <tr key={t.trace_id}><td><strong>{t.name}</strong><small>{date(t.created_at)}</small></td><td><Pill value={t.status} /></td><td>{(t.duration_ms / 1000).toFixed(2)}s</td><td>{number(t.total_tokens)}</td><td>${t.estimated_cost_usd.toFixed(6)}</td><td><button className="ad-button" type="button" onClick={() => setSelected(t.trace_id)}>Inspect<span className="sr-only"> {t.trace_id}</span></button></td></tr>)}
  </Table>{!query.data.length && <Empty>No traces recorded.</Empty>}</>}{selected && <><QueryNotice query={detail} />{detail.data != null && <JsonDetail data={detail.data} title={`Trace ${selected}`} />}</>}</Panel>
}
