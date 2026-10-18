import { useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check, Gift, Search, X } from 'lucide-react'
import { TeachingLanguages } from '../TeachingLanguages'
import { fetchAdminLanguages, setUserRole } from '../../lib/api'
import { fetchAccount, fetchAccounts, fetchLedger, giftPeppercorns, grantLanguageAccess, updateAccountStatus } from '../../lib/adminApi'
import { LANGUAGE_LABELS } from '../../lib/languageAccess'
import type { Role, User } from '../../types'
import { ActionMessage, Empty, Pager, Panel, Pill, QueryNotice, Table, date, number, useAdminAction } from './shared'

const languageLabel = (language: string) => LANGUAGE_LABELS[language] ?? language

export function People({ adminId, onGift }: { adminId: string; onGift: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['admin', 'accounts', search, role, status, offset], queryFn: () => fetchAccounts({ q: search, role: role || undefined, status: status || undefined, offset }) })
  return <>
    <Panel title="People & access" description="Manage roles, effective learning access and account status.">
      <div className="ad-filters"><label className="ad-search"><Search size={17} /><input aria-label="Search accounts" placeholder="Search by email…" value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} /></label><select aria-label="Filter by role" value={role} onChange={e => { setRole(e.target.value); setOffset(0) }}><option value="">All roles</option>{['student', 'instructor', 'admin'].map(r => <option key={r}>{r}</option>)}</select><select aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">All statuses</option><option>active</option><option>suspended</option></select></div>
      <QueryNotice query={query} />
      {query.data && !query.isError && <><Table headers={['Account', 'Role', 'Status', 'Peppercorns', '']}>
        {query.data.items.map(user => <tr key={user.id} className={selected === user.id ? 'selected' : ''}><td><strong>{user.email}</strong>{user.id === adminId && <small>Your account</small>}</td><td><Pill value={user.role} /></td><td><Pill value={user.status ?? 'active'} /></td><td className="ad-number">{number(user.peppercorns)}</td><td><button className="ad-button" type="button" onClick={() => setSelected(user.id)}>Manage<span className="sr-only"> {user.email}</span></button></td></tr>)}
      </Table>{!query.data.items.length && <Empty>No accounts match these filters.</Empty>}<Pager page={query.data} setOffset={setOffset} /></>}
    </Panel>
    {selected && <AccountPanel key={selected} id={selected} adminId={adminId} onGift={onGift} onClose={() => setSelected(null)} />}
  </>
}

function AccountPanel({ id, adminId, onGift, onClose }: { id: string; adminId: string; onGift: (id: string) => void; onClose: () => void }) {
  const query = useQuery({ queryKey: ['admin', 'account', id], queryFn: () => fetchAccount(id) })
  const client = useQueryClient()
  return <Panel title={query.data?.user.email ?? 'Account details'} description="Account access is determined by role, language scope and subscription expiry." action={<button type="button" className="ad-button ad-icon-button" aria-label="Close account details" onClick={onClose}><X size={17} /></button>}>
    <QueryNotice query={query} />
    {query.data && !query.isError && <>
      <div className="ad-account-summary"><Pill value={query.data.user.role} /><Pill value={query.data.user.status ?? 'active'} /><span>{number(query.data.user.peppercorns)} peppercorns</span><span>{query.data.user.strikes ?? 0} strikes</span></div>
      <p className="ad-note"><strong>Current learning access:</strong> {query.data.access.languages.map(languageLabel).join(', ') || 'No available languages'}. Created {date(query.data.user.created_at)}.</p>
      {query.data.user.role === 'student' && <button type="button" className="ad-button primary" onClick={() => onGift(id)}><Gift size={16} />Gift peppercorns / view ledger</button>}
      <div className="ad-two-col ad-inset"><div><h3>Language entitlements</h3>{query.data.subscriptions.length ? <ul className="ad-list">{query.data.subscriptions.map(s => <li key={s.id}><div><strong>{languageLabel(s.language)}</strong><small>{s.source} · ends {date(s.expires_at)}</small></div><Pill value={new Date(s.expires_at) <= new Date() ? 'expired' : s.status} /></li>)}</ul> : <Empty>No subscription entitlements recorded.</Empty>}<p className="ad-note">An unexpired cancellation can retain access until its end date. Peppercorn gifts do not grant a subscription.</p></div>
        <div><AccountActions key={`${id}:${query.data.user.role}:${query.data.user.status}`} user={query.data.user} self={id === adminId} /></div></div>
      {query.data.user.role === 'instructor' && <TeachingLanguages userId={id} onSaved={() => void client.invalidateQueries({ queryKey: ['admin', 'account', id] })} />}
      {query.data.user.role === 'student' && <AccessGrant id={id} />}
    </>}
  </Panel>
}

function AccountActions({ user, self }: { user: User; self: boolean }) {
  const [role, setRole] = useState<Role>(user.role)
  const [reason, setReason] = useState('')
  const roleAction = useAdminAction((next: Role) => setUserRole(user.id, next))
  const statusAction = useAdminAction(() => updateAccountStatus(user.id, user.status === 'suspended' ? 'active' : 'suspended', reason.trim()))
  return <div className="ad-stack"><h3>Account controls</h3><label>Account role<select value={role} disabled={self || roleAction.isPending} onChange={e => { roleAction.reset(); setRole(e.target.value as Role) }}>{['student', 'instructor', 'admin'].map(r => <option key={r}>{r}</option>)}</select></label><button type="button" className="ad-button" disabled={self || role === user.role || roleAction.isPending} onClick={() => roleAction.mutate(role)}>Apply role change</button><ActionMessage error={roleAction.error} success={roleAction.isSuccess && 'Role updated.'} />
      {self ? <p className="ad-note">Your own admin role and account status are protected.</p> : <form className="ad-stack" onSubmit={e => { e.preventDefault(); statusAction.mutate() }}><label>Reason for status change<textarea maxLength={500} minLength={3} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain this support or safety action" /></label><button type="submit" className={`ad-button ${user.status === 'suspended' ? '' : 'danger'}`} disabled={reason.trim().length < 3 || statusAction.isPending}>{user.status === 'suspended' ? 'Reinstate account & reset strikes' : 'Suspend account'}</button><ActionMessage error={statusAction.error} /></form>}
  </div>
}

function AccessGrant({ id }: { id: string }) {
  const choices = useQuery({ queryKey: ['admin', 'languages'], queryFn: fetchAdminLanguages })
  const [language, setLanguage] = useState('')
  const [days, setDays] = useState(30)
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(false)
  const action = useAdminAction(() => grantLanguageAccess(id, language, days, reason.trim()))
  return <details className="ad-details"><summary>Grant language access</summary><p className="ad-note">A manual entitlement grant. This does not collect payment or create a commercial plan.</p><QueryNotice query={choices} /><form className="ad-stack" onSubmit={e => { e.preventDefault(); if (review) action.mutate(); else setReview(true) }}>
    <fieldset disabled={review || action.isPending} className="ad-form-grid"><label>Language<select required value={language} onChange={e => setLanguage(e.target.value)}><option value="">Choose language</option>{choices.data?.map(l => <option key={l} value={l}>{languageLabel(l)}</option>)}</select></label><label>Duration in days<input type="number" min={1} max={3650} required value={days} onChange={e => setDays(Number(e.target.value))} /></label><label className="ad-full">Reason<input minLength={3} maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset>
    {review && <p className="ad-note">Grant {days} days of {languageLabel(language)} access? An existing manual entitlement may be extended.</p>}
    <div className="ad-row"><button type="submit" className="ad-button" disabled={action.isPending || !language || reason.trim().length < 3 || action.isSuccess}>{action.isPending ? 'Granting…' : review ? 'Confirm access grant' : 'Review access grant'}</button>{review && !action.isPending && !action.isSuccess && <button type="button" className="ad-text-button" onClick={() => setReview(false)}>Edit</button>}</div><ActionMessage error={action.error} success={action.isSuccess && 'Language access granted.'} /></form></details>
}

export function GiftForm({ student }: { student: User }) {
  const [amount, setAmount] = useState('50')
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)
  const action = useAdminAction(() => giftPeppercorns(student.id, Number(amount), reason.trim()))
  const valid = Number.isInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= 1_000_000 && reason.trim().length >= 3

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || lock.current) return
    if (!review) { setReview(true); return }
    lock.current = true
    try { await action.mutateAsync(); setUncertain(false) }
    catch (error) { setUncertain(!isAxiosError(error) || !error.response || (error.response.status === 409 && String(error.response.data?.detail).includes('processing'))) }
    finally { lock.current = false }
  }
  if (student.role !== 'student') return <Empty>Choose a student account to gift peppercorns.</Empty>
  if (action.isSuccess) return <div className="ad-gift-success" role="status"><span><Check size={26} /></span><h3>Gift delivered</h3><p>{number(Number(amount))} peppercorns were added to <strong>{student.email}</strong>.</p><p className="ad-note">The ledger and admin audit trail have been updated.</p><button type="button" className="ad-button" onClick={() => { action.reset(); setReview(false); setReason(''); setAmount('50') }}>Create another gift</button></div>
  return <form className="ad-stack" onSubmit={submit}>
    <div className="ad-recipient"><div className="ad-avatar">{student.email[0].toUpperCase()}</div><div><strong>{student.email}</strong><small>Current balance · {number(student.peppercorns)} peppercorns</small></div><Pill value={student.status ?? 'active'} /></div>
    <fieldset disabled={review || action.isPending} className="ad-stack"><label>Peppercorn amount<input type="number" min={1} max={1_000_000} step={1} required value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="ad-presets">{[25, 50, 100, 250].map(n => <button type="button" key={n} aria-pressed={Number(amount) === n} onClick={() => setAmount(String(n))}>+{n}</button>)}</div><label>Reason for gift<textarea minLength={3} maxLength={80} required placeholder="e.g. Welcome gift, learning milestone or support credit" value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset>
    {review && <div className="ad-gift-review"><span>Review gift</span><strong>+{number(Number(amount))} peppercorns</strong><p>To {student.email}</p><p>Reason: {reason.trim()}</p></div>}
    <p className="ad-note">Gifts add usage credits without charging the student. Their subscription languages and expiry remain unchanged.</p>
    {uncertain && <p className="ad-note" role="status">The outcome is not confirmed. Retry this same gift to check its receipt; duplicate retries use the same request key.</p>}
    <ActionMessage error={action.error} />
    <div className="ad-row"><button type="submit" className="ad-button primary" disabled={!valid || action.isPending}><Gift size={16} />{action.isPending ? 'Sending gift…' : review ? action.isError ? 'Retry this gift' : 'Confirm gift' : 'Review gift'}</button>{review && !uncertain && !action.isPending && <button type="button" className="ad-text-button" onClick={() => { setReview(false); action.reset() }}>Edit gift</button>}</div>
  </form>
}

export function Credits({ selectedId, setSelectedId, overview }: { selectedId: string | null; setSelectedId: (id: string | null) => void; overview?: { ledger_mismatches: number } }) {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const students = useQuery({ queryKey: ['admin', 'gift-students', search], queryFn: () => fetchAccounts({ q: search, role: 'student', limit: 10 }) })
  const account = useQuery({ queryKey: ['admin', 'account', selectedId], queryFn: () => fetchAccount(selectedId!), enabled: !!selectedId })
  const ledger = useQuery({ queryKey: ['admin', 'ledger', selectedId, offset], queryFn: () => fetchLedger(selectedId ?? undefined, offset) })
  return <>
    <div className="ad-two-col"><Panel title="Gift peppercorns" description="Recognize progress or resolve a support issue with student usage credits." action={<Gift size={21} />}>
      {selectedId ? <><button type="button" className="ad-text-button" onClick={() => { setSelectedId(null); setOffset(0) }}>Choose another student</button><QueryNotice query={account} />{account.data && !account.isError && <GiftForm key={selectedId} student={account.data.user} />}</> : <><label className="ad-search"><Search size={17} /><input aria-label="Find a student to gift" placeholder="Find a student by email…" value={search} onChange={e => setSearch(e.target.value)} /></label><QueryNotice query={students} />{students.data && !students.isError && <><ul className="ad-list">{students.data.items.map(s => <li key={s.id}><div><strong>{s.email}</strong><small>{number(s.peppercorns)} peppercorns · {s.status}</small></div><button type="button" className="ad-button" onClick={() => { setSelectedId(s.id); setOffset(0) }}>Select<span className="sr-only"> {s.email}</span></button></li>)}</ul>{!students.data.items.length && <Empty>No students match this search.</Empty>}<p className="ad-note">Showing up to 10 matching students. Refine your search to find an account.</p></>}</>}
    </Panel><Panel title="Ledger integrity" description="Balances are checked against their complete transaction histories."><div className="ad-integrity"><span className={overview?.ledger_mismatches ? 'ad-integrity-warning' : ''}>{overview ? number(overview.ledger_mismatches) : '—'}</span><h3>{overview ? overview.ledger_mismatches ? 'Balances need investigation' : 'No balance discrepancies' : 'Awaiting integrity measurement'}</h3><p>Every gift writes an append-only credit entry and an admin audit event. Existing balances are never overwritten.</p></div><p className="ad-note">This checks ledger balances, not payment settlement. Subscription payments and commercial pricing are separate.</p></Panel></div>
    <Panel title="Transaction ledger" description={selectedId ? `Transactions for ${account.data?.user.email ?? 'the selected student'}.` : 'All accounts · newest first.'} action={selectedId && <button type="button" className="ad-button" onClick={() => { setSelectedId(null); setOffset(0) }}>Show all accounts</button>}><QueryNotice query={ledger} />{ledger.data && !ledger.isError && <><Table headers={['Account', 'Movement', 'Balance after', 'Reason', 'Recorded']}>
      {ledger.data.items.map(t => <tr key={t.id}><td>{t.email}</td><td className={t.amount > 0 ? 'ad-positive' : ''}>{t.amount > 0 ? '+' : ''}{number(t.amount)}</td><td className="ad-number">{number(t.balance_after)}</td><td>{t.reason}</td><td className="ad-date">{date(t.created_at)}</td></tr>)}
    </Table>{!ledger.data.items.length && <Empty>No transactions recorded for this selection.</Empty>}<Pager page={ledger.data} setOffset={setOffset} /></>}</Panel>
  </>
}
