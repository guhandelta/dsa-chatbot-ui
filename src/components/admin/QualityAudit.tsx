import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAudit, fetchRoutingUsage, fetchRuntime, type Overview } from '../../lib/adminApi'
import { Readiness } from './Content'
import { Empty, JsonDetail, Pager, Panel, Pill, QueryNotice, Table, date, label, number } from './shared'

export function Quality({ days, overview }: { days: number; overview?: Overview }) {
  const query = useQuery({ queryKey: ['admin', 'routing', days], queryFn: () => fetchRoutingUsage(days) })
  const sample = overview?.trace_sample
  return <>
    <div className="ad-two-col"><Panel title="Measured AI usage" description={`Selected window · last ${days} days.`}><div className="ad-mini-metrics"><div><strong>{sample?.p95_ms == null ? '—' : `${(sample.p95_ms / 1000).toFixed(1)}s`}</strong><span>Sample p95 latency</span></div><div><strong>{sample?.estimated_cost_usd == null ? '—' : `$${sample.estimated_cost_usd.toFixed(4)}`}</strong><span>Sample estimated cost</span></div><div><strong>{sample?.tokens == null ? '—' : number(sample.tokens)}</strong><span>Recorded tokens</span></div></div><p className="ad-note">{sample?.coverage ?? 'No usage measurement available.'}</p><p className="ad-note">{sample ? `${number(sample.sampled)} traces sampled of ${number(sample.total)} in this period.` : 'Not measured.'} Missing or incomplete usage is not confirmed zero cost. Model rates are estimates, not provider invoices.</p></Panel>
      <Panel title="Quality is a separate measure" description="A completed answer is not evidence of a correct or useful answer."><p>Review grounding, hint usefulness, solution withholding, language scope and execution evidence against representative questions.</p><p className="ad-note">Current routing preferences are configurable policy rules, not measured provider rankings. Live quality feedback and a representative response-rating workflow are not yet measured here.</p><span className="ad-pill warning">Human review required</span></Panel></div>
    <Panel title="Chat model routing" description="Actual model metadata from successful chat receipts."><QueryNotice query={query} />{query.data && !query.isError && <><Table headers={['Provider', 'Configured model used', 'Task', 'Answers', 'Failure fallbacks']}>
      {query.data.items.map(r => <tr key={`${r.provider}:${r.model}:${r.task}`}><td>{r.provider}</td><td><code>{r.model}</code></td><td>{r.task}</td><td>{number(r.answers)}</td><td>{number(r.fallbacks)}</td></tr>)}
    </Table>{!query.data.items.length && <Empty>No recorded model-routing metadata for this period.</Empty>}<p className="ad-note">{query.data.note} Metadata is present for {query.data.measured} of {query.data.sampled} sampled receipts; {query.data.total_completed_chats} total successful chats.</p></>}</Panel><Readiness />
  </>
}

export function AuditConfiguration() {
  const [offset, setOffset] = useState(0)
  const audit = useQuery({ queryKey: ['admin', 'audit', offset], queryFn: () => fetchAudit(offset) })
  const runtime = useQuery({ queryKey: ['admin', 'runtime'], queryFn: fetchRuntime })
  return <>
    <Panel title="Administrative audit trail" description="Changes recorded since the admin audit feature was introduced. Historical actions are not backfilled."><QueryNotice query={audit} />{audit.data && !audit.isError && <><Table headers={['Administrator', 'Action', 'Target', 'Reason / details', 'Recorded']}>
      {audit.data.items.map(a => <tr key={a.id}><td>{a.actor_email}</td><td>{label(a.action)}</td><td><code>{a.target_id}</code></td><td>{a.reason || 'No note'}<JsonDetail data={{ before: a.before, after: a.after }} title="Before & after" /></td><td className="ad-date">{date(a.created_at)}</td></tr>)}
    </Table>{!audit.data.items.length && <Empty>No administrative changes have been recorded yet.</Empty>}<Pager page={audit.data} setOffset={setOffset} /></>}</Panel>
    <Panel title="AI configuration" description="Read-only runtime settings. API keys and secrets are never returned by this view."><QueryNotice query={runtime} />{runtime.data && !runtime.isError && <><Table headers={['Provider', 'Model', 'Configuration', 'Connectivity']}>
      {runtime.data.providers.map(p => <tr key={p.provider}><td>{p.provider}</td><td><code>{p.model}</code></td><td><Pill value="configured" /></td><td>{p.connectivity}</td></tr>)}
    </Table>{!runtime.data.providers.length && <Empty>No tutor providers are configured.</Empty>}<div className="ad-two-col ad-inset"><dl className="ad-facts">{Object.entries(runtime.data.routing_preferences).map(([task, provider]) => <div key={task}><dt>{label(task)} preference</dt><dd>{provider}</dd></div>)}<div><dt>Per-attempt timeout</dt><dd>{runtime.data.model_timeout_seconds}s</dd></div></dl><dl className="ad-facts"><div><dt>Experimental retrieval</dt><dd>{runtime.data.agentic_enabled ? 'Enabled for admin opt-in' : 'Disabled'}</dd></div><div><dt>Tracing</dt><dd>{runtime.data.tracing_enabled ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Execution image</dt><dd><code>{runtime.data.execution_image ?? 'Not configured'}</code></dd></div></dl></div><p className="ad-note">Preferences and deployment settings are managed in the API configuration. Reading this view does not probe a paid model, execute code or modify the runtime.</p></>}</Panel>
  </>
}
