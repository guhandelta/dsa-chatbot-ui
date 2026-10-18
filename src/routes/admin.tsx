import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, BookOpenCheck, ChartNoAxesCombined, Coins, LayoutDashboard, RefreshCw, ScrollText, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { requireAdminAccess } from '../lib/routeAccess'
import { fetchOverview } from '../lib/adminApi'
import { Overview, type AdminView } from '../components/admin/Overview'
import { People, Credits } from '../components/admin/PeopleCredits'
import { Content } from '../components/admin/Content'
import { Operations } from '../components/admin/Operations'
import { Quality, AuditConfiguration } from '../components/admin/QualityAudit'
import { QueryNotice, date } from '../components/admin/shared'
import '../admin.css'

export const Route = createFileRoute('/admin')({ beforeLoad: requireAdminAccess, component: AdminPage })

const views = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard, caption: 'Your workspace at a glance' },
  { id: 'people', title: 'People & access', icon: Users, caption: 'Accounts, roles and language entitlements' },
  { id: 'content', title: 'Content & reviews', icon: BookOpenCheck, caption: 'Source approvals and readiness evidence' },
  { id: 'credits', title: 'Peppercorns', icon: Coins, caption: 'Student gifts and the transaction ledger' },
  { id: 'operations', title: 'Operations & safety', icon: ShieldCheck, caption: 'Service health, recovery and security events' },
  { id: 'quality', title: 'AI quality & usage', icon: ChartNoAxesCombined, caption: 'Model routing and measured usage' },
  { id: 'audit', title: 'Audit & configuration', icon: ScrollText, caption: 'Administrative changes and runtime configuration' },
] as const

export function AdminPage() {
  const { user, initializing } = useAuth()
  const [view, setView] = useState<AdminView>('overview')
  const [days, setDays] = useState(7)
  const [giftStudent, setGiftStudent] = useState<string | null>(null)
  const client = useQueryClient()
  const fetching = useIsFetching({ queryKey: ['admin'] })
  const allowed = !initializing && user?.role === 'admin'
  const overview = useQuery({ queryKey: ['admin', 'overview', days], queryFn: () => fetchOverview(days), enabled: allowed })
  const current = views.find(v => v.id === view)!
  if (initializing) return <main className="page-wrap py-12"><p role="status">Checking admin access…</p></main>
  if (!allowed || !user) return <main className="page-wrap py-12"><h1>Admin access required</h1><p>This workspace is available to administrators.</p></main>

  return <main className="admin-dashboard">
    <div className="ad-topbar"><div><p className="ad-eyebrow"><span />ADMIN WORKSPACE</p><h1>Admin Dashboard</h1><p>Keep learning useful, access clear, and operations accountable.</p></div><div className="ad-top-actions"><label>Metrics window<select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}</select></label><button className="ad-button" type="button" disabled={fetching > 0} onClick={() => void client.invalidateQueries({ queryKey: ['admin'] })}><RefreshCw size={16} className={fetching ? 'ad-spin' : ''} />Refresh</button></div></div>
    <div className="ad-layout"><aside className="ad-sidebar"><div className="ad-sidebar-label">MANAGE</div><nav aria-label="Admin sections">{views.map(({ id, title, icon: Icon }) => <button key={id} type="button" className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><Icon size={18} /><span>{title}</span>{id === 'content' && !!overview.data?.pending_documents && <b>{overview.data.pending_documents}</b>}</button>)}</nav><div className="ad-sidebar-tools"><span className="ad-sidebar-label">TEACHING TOOLS</span><Link to="/train">Train knowledge base <ArrowUpRight size={15} /></Link><Link to="/registry">Tech Board <ArrowUpRight size={15} /></Link></div><div className="ad-sidebar-user"><div className="ad-avatar"><SlidersHorizontal size={19} /></div><div><strong>Administrator</strong><small>{user.email}</small></div></div></aside>
      <div className="ad-workspace"><div className="ad-view-heading"><div><span>Workspace / {current.title}</span><h2>{current.title}</h2><p>{current.caption}</p></div></div>
        {view === 'overview' && <><QueryNotice query={overview} />{overview.data && !overview.isError && <Overview data={overview.data} navigate={setView} />}</>}
        {view === 'people' && <People adminId={user.id} onGift={id => { setGiftStudent(id); setView('credits') }} />}
        {view === 'content' && <Content />}
        {view === 'credits' && <Credits selectedId={giftStudent} setSelectedId={setGiftStudent} overview={overview.isError ? undefined : overview.data} />}
        {view === 'operations' && <Operations days={days} overview={overview.isError ? undefined : overview.data} managePeople={() => setView('people')} />}
        {view === 'quality' && <Quality days={days} overview={overview.isError ? undefined : overview.data} />}
        {view === 'audit' && <AuditConfiguration />}
        <p className="ad-workspace-footer">Overview measured {overview.data && !overview.isError ? date(overview.data.generated_at) : '—'}. Account state, queues and ledger are current; activity metrics use the selected window.</p>
      </div>
    </div>
  </main>
}
