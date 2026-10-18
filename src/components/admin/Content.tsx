import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, BookOpenCheck, X } from 'lucide-react'
import { fetchDocument, fetchDocuments, fetchReadiness, fetchSubmissions, reviewDocument } from '../../lib/adminApi'
import { ActionMessage, Empty, JsonDetail, Pager, Panel, Pill, QueryNotice, Table, date, number, useAdminAction } from './shared'

export function Content() {
  const [mode, setMode] = useState('documents')
  return <>
    <div className="ad-section-intro"><div><h2>Content & readiness</h2><p>Review what reaches learners and inspect the evidence behind your catalogue.</p></div><Link className="ad-button" to="/registry">Open Tech Board <ArrowUpRight size={16} /></Link></div>
    <div className="ad-segments" aria-label="Content views"><button type="button" aria-pressed={mode === 'documents'} onClick={() => setMode('documents')}>Learning documents</button><button type="button" aria-pressed={mode === 'submissions'} onClick={() => setMode('submissions')}>Problem submissions</button><button type="button" aria-pressed={mode === 'readiness'} onClick={() => setMode('readiness')}>Readiness evidence</button></div>
    {mode === 'documents' ? <Documents /> : mode === 'submissions' ? <Submissions /> : <Readiness />}
  </>
}

function Documents() {
  const [status, setStatus] = useState('pending')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['admin', 'documents', status, offset], queryFn: () => fetchDocuments(status || undefined, offset) })
  return <>
    <Panel title="Document review queue" description="Only approved reference excerpts can be used by the tutor." action={<BookOpenCheck size={20} />}>
      <div className="ad-filters"><label>Publication status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); setSelected(null) }}><option value="">All documents</option><option value="pending">Awaiting approval</option><option value="published">Published</option><option value="rejected">Rejected</option></select></label></div><QueryNotice query={query} />
      {query.data && !query.isError && <><Table headers={['Document', 'Author', 'Language', 'Status', '']}>
        {query.data.items.map(doc => <tr key={doc.id}><td><strong>{doc.filename}</strong><small>{date(doc.created_at)}</small></td><td>{doc.owner_email}</td><td>{doc.reference_language ?? 'Unclassified'}</td><td><Pill value={doc.status} /></td><td><button type="button" className="ad-button" onClick={() => setSelected(doc.id)}>Review<span className="sr-only"> {doc.filename}</span></button></td></tr>)}
      </Table>{!query.data.items.length && <Empty>No documents in this queue.</Empty>}<Pager page={query.data} setOffset={setOffset} /></>}
    </Panel>
    {selected && <DocumentReview key={selected} id={selected} close={() => setSelected(null)} />}
  </>
}

function DocumentReview({ id, close }: { id: string; close: () => void }) {
  const query = useQuery({ queryKey: ['admin', 'document', id], queryFn: () => fetchDocument(id) })
  const [note, setNote] = useState('')
  const [confirmation, setConfirmation] = useState<'approve' | 'reject' | null>(null)
  const action = useAdminAction((choice: 'approve' | 'reject') => reviewDocument(id, choice, note.trim()))
  return <Panel title={query.data?.filename ?? 'Review document'} description="Inspect the extracted source before changing its publication status." action={<button type="button" aria-label="Close document review" className="ad-button ad-icon-button" onClick={close}><X size={17} /></button>}>
    <QueryNotice query={query} />{query.data && !query.isError && <>
      <div className="ad-account-summary"><Pill value={query.data.status} /><span>{query.data.owner_email}</span><span>{number(query.data.characters)} characters</span><span>{number(query.data.reference_chunks)} reference excerpts</span></div>
      <p className="ad-note">This is a truncated extracted-text preview. Publication makes approved reference excerpts available to learners; it does not certify an exercise or every teaching claim.</p>
      <pre className="ad-document-preview">{query.data.preview || 'No preview available.'}</pre>
      {query.data.review_note && <p className="ad-note">Previous review: {query.data.review_note}</p>}
      <div className="ad-stack"><label>Review note<textarea value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Explain a rejection or withdrawal" /></label><div className="ad-row">
        {query.data.status !== 'published' && <button type="button" className="ad-button primary" disabled={action.isPending} onClick={() => { action.reset(); setConfirmation('approve') }}>Approve for publication</button>}
        {query.data.status !== 'rejected' && <button type="button" className="ad-button danger" disabled={action.isPending || note.trim().length < 3} onClick={() => { action.reset(); setConfirmation('reject') }}>{query.data.status === 'published' ? 'Withdraw publication' : 'Reject document'}</button>}
      </div>{confirmation && !action.isSuccess && <div className="ad-confirm"><p>{confirmation === 'approve' ? 'Publish the approved reference excerpts from this document?' : 'Withhold this document from learner retrieval?'}</p><button type="button" className="ad-button" disabled={action.isPending} onClick={() => action.mutate(confirmation)}>{action.isPending ? 'Applying…' : 'Confirm review decision'}</button><button type="button" className="ad-text-button" disabled={action.isPending} onClick={() => setConfirmation(null)}>Cancel</button></div>}<ActionMessage error={action.error} success={action.isSuccess && 'Review decision saved.'} /></div>
    </>}
  </Panel>
}

function Submissions() {
  const [status, setStatus] = useState('needs_review')
  const [offset, setOffset] = useState(0)
  const query = useQuery({ queryKey: ['admin', 'submissions', status, offset], queryFn: () => fetchSubmissions(status || undefined, offset) })
  return <Panel title="Problem validation reports" description="Inspect execution evidence and follow up on failed or incomplete submissions." action={<Link className="ad-button" to="/train">Open Train <ArrowUpRight size={16} /></Link>}>
    <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value="">All submissions</option><option value="needs_review">Needs review</option><option value="failed">Failed</option><option value="published">Published</option></select></label><QueryNotice query={query} />
    {query.data && !query.isError && <><Table headers={['Problem', 'Author', 'Status', 'Recorded', 'Evidence']}>
      {query.data.items.map(s => <tr key={s.id}><td>{s.problem_id}</td><td>{s.email}</td><td><Pill value={s.status} /></td><td className="ad-date">{date(s.created_at)}</td><td><JsonDetail data={s.report} title="Validation report" /></td></tr>)}
    </Table>{!query.data.items.length && <Empty>No submissions match this status.</Empty>}<Pager page={query.data} setOffset={setOffset} /></>}
    <p className="ad-note">A review flag cannot be cleared by bypassing execution validation. Correct the problem and resubmit it through Train.</p>
  </Panel>
}

export function Readiness() {
  const query = useQuery({ queryKey: ['admin', 'readiness'], queryFn: fetchReadiness })
  return <Panel title="Recorded readiness evidence" description="Separate reference availability, executable exercises and editorial review."><QueryNotice query={query} />
    <div className="ad-readiness-types"><div><strong>Reference material</strong><p>Searchable learning sources. Ingestion is not a correctness certification.</p></div><div><strong>Execution evidence</strong><p>Tests and runtime checks, valid within their documented scope.</p></div><div><strong>Teaching quality</strong><p>Requires review of correctness, useful hints and appropriate guidance.</p></div></div>
    {query.data && !query.isError && <><p className="ad-note">{query.data.note}</p><ul className="ad-list">{query.data.artifacts.map(a => <li key={a.name}><div><strong>{a.name.replaceAll('-', ' ').replace('.json', '')}</strong><small>{a.available ? `File updated ${date(a.file_updated_at)}` : 'No readable evidence artifact'}</small>{a.available && <JsonDetail data={a.summary} title="Recorded summary" />}</div><Pill value={a.available ? 'recorded' : 'not measured'} /></li>)}</ul></>}
  </Panel>
}
