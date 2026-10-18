import { ArrowUpRight, BookOpenCheck, Coins, Layers, ShieldAlert, Users, Workflow } from 'lucide-react'
import type { Overview as OverviewData } from '../../lib/adminApi'
import { Panel, date, number } from './shared'

export type AdminView = 'overview' | 'people' | 'content' | 'credits' | 'operations' | 'quality' | 'audit'

export function Overview({ data, navigate }: { data: OverviewData; navigate: (view: AdminView) => void }) {
  const cards = [
    { title: 'Students with access', value: data.entitled_students, hint: 'Current, unexpired language entitlements', icon: Users, view: 'people' as const, featured: true },
    { title: 'Active students', value: data.active_students, hint: `Completed learning operations · last ${data.days} days`, icon: Workflow, view: 'people' as const },
    { title: 'Awaiting approval', value: data.pending_documents, hint: data.oldest_pending_at ? `Oldest upload: ${date(data.oldest_pending_at)}` : 'Document review queue is clear', icon: BookOpenCheck, view: 'content' as const },
    { title: 'Service failures', value: data.service_failures, hint: `Operations returning 5xx · last ${data.days} days`, icon: ShieldAlert, view: 'operations' as const },
  ]
  const tasks = [
    { title: 'Review learning documents', count: data.pending_documents, detail: 'Approve source material before it reaches learners.', view: 'content' as const },
    { title: 'Inspect problem submissions', count: data.training_needs_review, detail: 'Inspect validation reports for submissions needing review.', view: 'content' as const },
    { title: 'Investigate expired reservations', count: data.stuck_operations, detail: 'Running for more than 30 minutes; automatic recovery should settle them.', view: 'operations' as const },
    { title: 'Review ledger discrepancies', count: data.ledger_mismatches, detail: 'Balances that differ from their transaction history.', view: 'credits' as const },
  ]
  return <>
    <div className="ad-metrics">{cards.map(({ title, value, hint, icon: Icon, view, featured }) => <button key={title} type="button" onClick={() => navigate(view)} className={`ad-metric ${featured ? 'featured' : ''}`}><div className="ad-metric-top"><span>{title}</span><Icon size={19} /></div><strong>{number(value)}</strong><small>{hint}</small><ArrowUpRight className="ad-metric-arrow" size={18} /></button>)}</div>
    <div className="ad-two-col"><Panel title="Needs your attention" description="Review queues and operational exceptions.">{tasks.map(task => <button type="button" className="ad-task" key={task.title} onClick={() => navigate(task.view)}><div><strong>{task.title}</strong><small>{task.detail}</small></div><span className={`ad-count ${task.count ? 'attention' : ''}`}>{number(task.count)}</span><ArrowUpRight size={17} /></button>)}</Panel>
      <Panel title="Workspace snapshot" description="Current accounts and access."><dl className="ad-facts"><div><dt>Students</dt><dd>{number(data.users_by_role.student ?? 0)}</dd></div><div><dt>Instructors</dt><dd>{number(data.users_by_role.instructor ?? 0)}</dd></div><div><dt>Administrators</dt><dd>{number(data.users_by_role.admin ?? 0)}</dd></div><div><dt>Language entitlements expiring in 7 days</dt><dd>{number(data.expiring_subscriptions)}</dd></div><div><dt>Suspended accounts</dt><dd>{number(data.suspended_users)}</dd></div></dl><p className="ad-note">Access counts include manual grants and retained cancellation periods. They are not a count of paying subscribers.</p></Panel></div>
    <div className="ad-two-col"><Panel title="Peppercorn activity" description={`Ledger movements over the last ${data.days} days.`} action={<Coins size={20} />}><div className="ad-mini-metrics"><div><strong>{number(data.credits_spent)}</strong><span>Spent</span></div><div><strong>{number(data.credits_refunded)}</strong><span>Refunded</span></div><div><strong>{number(data.credits_added)}</strong><span>All credits added</span></div></div><p className="ad-note">Credits added includes gifts, bonuses and refunds. Peppercorns are internal usage credits, not collected revenue.</p><button type="button" className="ad-text-button" onClick={() => navigate('credits')}>Open ledger & gift credits <ArrowUpRight size={15} /></button></Panel>
      <Panel title="Observed learning activity" description={`Recorded learning events · last ${data.days} days.`} action={<Layers size={20} />}><div className="ad-mini-metrics"><div><strong>{number(data.learning_events.attempt ?? 0)}</strong><span>Attempt events</span></div><div><strong>{number(data.learning_events.solved ?? 0)}</strong><span>Solve events</span></div><div><strong>{number(data.learning_events.hint ?? 0)}</strong><span>Hint events</span></div></div><p className="ad-note">Event totals can include repeated work. They do not measure distinct mastered exercises or prove learning outcomes.</p></Panel></div>
  </>
}
