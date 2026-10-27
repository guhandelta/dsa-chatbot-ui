// Reference-document uploads for the RAG knowledge base (POST /teach/train).
// Teachers upload and track their documents; their uploads stay "pending"
// until an admin approves them, because anything published here is fed to
// every learner's chat. Admins publish directly and work the review queue.
import { useCallback, useEffect, useState } from 'react'
import {
  approveKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchKnowledgeDocument,
  fetchKnowledgeDocuments,
  fetchKnowledgeInventory,
  fetchLearnStatus,
  fetchTracks,
  getApiErrorMessage,
  rejectKnowledgeDocument,
  uploadKnowledge,
} from '../lib/api'
import { LANGUAGE_LABELS } from '../lib/languageAccess'
import type {
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  KnowledgeInventory,
  KnowledgeStatus,
  KnowledgeTrack,
  LearnStatus,
} from '../types'

// Used until /teach/status answers, and if it never does.
const DEFAULT_FORMATS = ['.doc', '.docx', '.md', '.pdf', '.txt']
const DEFAULT_MAX_MB = 10

const TRACK_LABELS: Record<KnowledgeTrack, string> = {
  custom: 'All tracks (shared reference)',
  dsa: 'DSA problems',
  algorithm: 'Algorithms',
  language: 'Language',
}

const FILTERS: { key: KnowledgeStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
]

export function KnowledgeUploadPanel({ isAdmin }: { isAdmin: boolean }) {
  const [learnStatus, setLearnStatus] = useState<(LearnStatus & { training_languages?: string[] }) | null>(null)
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [text, setText] = useState('')
  const [filename, setFilename] = useState('')
  const [language, setLanguage] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [track, setTrack] = useState<KnowledgeTrack>('custom')
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<KnowledgeStatus | 'all'>(isAdmin ? 'pending' : 'all')
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<KnowledgeDocumentDetail | null>(null)
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null)
  const [inventory, setInventory] = useState<KnowledgeInventory | null>(null)
  const [inventoryError, setInventoryError] = useState<string | null>(null)

  const formats = learnStatus?.supported_formats ?? DEFAULT_FORMATS
  const maxMb = learnStatus?.max_upload_mb ?? DEFAULT_MAX_MB
  const tracks = learnStatus?.allowed_tracks ?? (Object.keys(TRACK_LABELS) as KnowledgeTrack[])

  useEffect(() => {
    fetchLearnStatus()
      .then(setLearnStatus)
      .catch(() => setLearnStatus(null))
  }, [])

  useEffect(() => {
    fetchKnowledgeInventory().then(setInventory).catch((err) => {
      setInventoryError(getApiErrorMessage(err))
    })
  }, [])

  useEffect(() => {
    fetchTracks().then(data => setLanguages(data.training_languages ?? [])).catch(() => setLanguages([]))
  }, [])

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true)
    try {
      setDocs(await fetchKnowledgeDocuments(filter === 'all' ? undefined : filter))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoadingDocs(false)
    }
  }, [filter])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  const validate = (): string | null => {
    if (mode === 'file') {
      if (!file) return 'Choose a document to upload.'
      const dot = file.name.lastIndexOf('.')
      const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
      if (!formats.includes(ext)) {
        return `Unsupported file type${ext ? ` "${ext}"` : ''}. Use ${formats.join(', ')}.`
      }
      if (file.size > maxMb * 1024 * 1024) return `File is larger than ${maxMb} MB.`
      return null
    }
    return text.trim() ? null : 'Paste some notes to upload.'
  }

  const handleUpload = async () => {
    if (uploading) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setUploading(true)
    setError(null)
    setNotice(null)
    try {
      const result =
        mode === 'file' && file
          ? await uploadKnowledge({ file, track, ...(language ? { language } : {}) })
          : await uploadKnowledge({ text, filename: filename.trim(), track, ...(language ? { language } : {}) })
      setNotice(result.message)
      setFile(null)
      setFileInputKey((k) => k + 1)
      setText('')
      setFilename('')
      await loadDocs()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  // Runs a row action with a per-row busy flag, then refreshes the list.
  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      await fn()
      setNotice(done)
      if (preview?.id === id) setPreview(null)
      await loadDocs()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const togglePreview = async (id: string) => {
    if (preview?.id === id) {
      setPreview(null)
      return
    }
    setBusyId(id)
    try {
      setPreview(await fetchKnowledgeDocument(id))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = (doc: KnowledgeDocument) => {
    if (!window.confirm(`Delete "${doc.filename}"? Chat will stop using it.`)) return
    void act(doc.id, () => deleteKnowledgeDocument(doc.id), `Deleted "${doc.filename}".`)
  }

  const confirmReject = () => {
    if (!rejecting) return
    const { id, note } = rejecting
    setRejecting(null)
    void act(id, () => rejectKnowledgeDocument(id, note.trim()), 'Document rejected.')
  }

  return (
    <section className="island-shell kb-panel mt-6 rounded-2xl p-4 sm:p-6" aria-labelledby="kb-title">
      <p className="island-kicker mb-1">Knowledge base</p>
      <h2 id="kb-title" className="display-title mb-2 text-2xl font-bold text-[var(--sea-ink)]">
        Upload reference material
      </h2>
      <p className="mb-4 max-w-3xl text-sm text-[var(--sea-ink-soft)]">
        Notes, handouts and cheat sheets become context the chatbot can quote.{' '}
        {isAdmin
          ? 'Your uploads publish immediately.'
          : 'An admin reviews each upload before learners see it.'}
      </p>
      <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--sea-ink-soft)]" role="note">
        <strong className="text-[var(--sea-ink)]">Status guide:</strong> Published means available to retrieval when its scope matches. It does not mean examples ran successfully or the material passed a pedagogical review. The inventory below reports those evidence states separately.
      </div>

      <section className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4" aria-labelledby="kb-inventory-title">
        <h3 id="kb-inventory-title" className="mb-1 text-base font-bold text-[var(--sea-ink)]">Packaged curriculum and knowledge sources</h3>
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">Counts and fingerprints describe what is stored. They do not certify correctness or teaching quality.</p>
        {inventoryError ? <p role="status" className="text-sm text-[var(--sea-ink-soft)]">Packaged inventory unavailable: {inventoryError}</p> : !inventory ? (
          <p className="text-sm text-[var(--sea-ink-soft)]" role="status">Loading packaged inventory…</p>
        ) : (
          <ul className="space-y-3">
            {inventory.sources.map((source) => (
              <li key={source.source_id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm text-[var(--sea-ink)]">{source.path}</strong>
                  <span className="text-xs text-[var(--sea-ink-soft)]">{source.record_count.toLocaleString()} records · {source.quality_status.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Languages: {Object.keys(source.by_language).join(', ') || 'none recorded'} · Retrieval: {source.retrieval_status} · Execution: {source.executable_examples} · Pedagogical review: {source.pedagogical_review}</p>
                <details className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  <summary className="cursor-pointer">Subject scope ({Object.keys(source.by_subject).length})</summary>
                  <p className="mt-1">{Object.entries(source.by_subject).map(([subject, count]) => `${subject} (${count})`).join(' · ') || 'No subjects recorded'}</p>
                </details>
                {source.by_declared_version && <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Declared versions: {Object.entries(source.by_declared_version).map(([version, count]) => `${version} (${count})`).join(', ')}</p>}
                {source.declared_version != null && <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Dataset version: {source.declared_version}{source.declared_status ? ` · status ${source.declared_status}` : ''}</p>}
                {source.provenance_coverage && <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">Source provenance recorded for {source.provenance_coverage.records_with_provenance.toLocaleString()} / {source.record_count.toLocaleString()} records ({source.provenance_coverage.distinct_labels.toLocaleString()} distinct labels)</p>}
                <p className="mt-1 break-all text-xs text-[var(--sea-ink-soft)]">SHA-256: {source.content_sha256 ?? 'unavailable'} · {source.provenance}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="lang-tabs mb-3" role="tablist" aria-label="Upload type">
        {(['file', 'text'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`lang-tab ${mode === m ? 'is-active' : ''}`}
          >
            {m === 'file' ? 'Upload a file' : 'Paste text'}
          </button>
        ))}
      </div>

      <div className="mb-4">
          <label
            className="selector grow rounded-xl border-2 border-dashed p-5 transition-colors"
            style={{ borderColor: dragging ? 'var(--lagoon)' : 'var(--line)', background: dragging ? 'var(--sand)' : 'var(--surface)' }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = uploading ? 'none' : 'copy'
              if (!uploading) setDragging(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (uploading) return
              if (event.dataTransfer.files.length !== 1) {
                setError('Drop one document at a time.')
                return
              }
              setFile(event.dataTransfer.files[0])
              setMode('file')
              setError(null)
              setNotice(null)
            }}
          >
            <span className="font-semibold text-[var(--sea-ink)]">Drag and drop training data here, or choose a file</span>
            <span className="selector-label">Document ({formats.join(', ')} · max {maxMb} MB)</span>
            <input
              key={fileInputKey}
              type="file"
              accept={formats.join(',')}
              disabled={uploading}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setMode('file')
                setError(null)
              }}
            />
            <span aria-live="polite" className="text-sm text-[var(--sea-ink)]">{file ? `Selected: ${file.name}` : ''}</span>
          </label>
      </div>

      <div className="controls mb-3">
        {mode === 'text' && (
          <label className="selector grow">
            <span className="selector-label">Name (optional)</span>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. heaps-cheatsheet.md"
            />
          </label>
        )}
        <label className="selector">
          <span className="selector-label">Use in</span>
          <select value={track} onChange={(e) => setTrack(e.target.value as KnowledgeTrack)}>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {TRACK_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className="selector">
          <span className="selector-label">Reference language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Detect from filename</option>
            <option value="all_languages">Language-neutral / all languages</option>
            {(learnStatus?.training_languages ?? languages).map(l => <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>)}
          </select>
        </label>
      </div>

      {mode === 'text' && (
        <label className="selector mb-3 block">
          <span className="selector-label">Notes</span>
          <textarea
            className="train-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste Markdown or plain text. ## headings become separate, searchable sections."
          />
        </label>
      )}

      {error && (
        <div className="error-banner mb-3" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="kb-notice mb-3" role="status">
          {notice}
        </div>
      )}

      <button type="button" onClick={handleUpload} disabled={uploading} className="primary-btn">
        {uploading ? 'Uploading…' : isAdmin ? 'Upload & publish' : 'Upload for review'}
      </button>

      <div className="kb-list-head mt-6 mb-2">
        <h3 className="m-0 text-base font-bold text-[var(--sea-ink)]">
          {isAdmin ? 'All uploads' : 'Your uploads'}
        </h3>
        <div className="lang-tabs" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`lang-tab ${filter === f.key ? 'is-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loadingDocs ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[var(--sea-ink-soft)]">No documents here yet.</p>
      ) : (
        <ul className="kb-list">
          {docs.map((doc) => {
            const busy = busyId === doc.id
            return (
              <li key={doc.id} className="kb-item">
                <div className="kb-item-row">
                  <div className="kb-item-meta">
                    <strong className="kb-filename">{doc.filename}</strong>
                    <span className={`kb-badge kb-badge-${doc.status}`}>{doc.status}</span>
                    {doc.status === 'published' && <span className="kb-badge">Available for retrieval</span>}
                    <span className="kb-sub">
                      {TRACK_LABELS[doc.track] ?? doc.track} · {doc.characters.toLocaleString()} chars
                      {doc.status === 'published' && ` · ${doc.chunks} chunks`}
                    </span>
                    <span className="kb-sub">
                      Language: {doc.reference_language === 'all_languages' ? 'Language-neutral / all languages' : (doc.reference_language ?? 'Unclassified')} · Track: {TRACK_LABELS[doc.track] ?? doc.track} · Topic: {doc.topic_scope || 'not recorded'} · Retrieval: {doc.retrieval_status ?? 'status unavailable'}
                    </span>
                    <span className="kb-sub">
                      Publication review: {doc.publication_review ?? (doc.status === 'published' ? 'published; approval details unavailable' : doc.status)} · Execution evidence: {doc.executable_verification === 'verified' ? 'verified' : doc.executable_verification === 'failed' ? 'failed' : 'not recorded'} · Teaching review: {doc.pedagogical_review === 'reviewed' ? 'reviewed' : doc.pedagogical_review === 'needs_revision' ? 'needs revision' : 'not recorded'}
                    </span>
                    <span className="kb-sub">
                      Source: {isAdmin ? (doc.owner_email || 'uploader unavailable') : 'your upload'} · Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleString() : 'date unavailable'}{doc.reviewed_at ? ` · Publication decision: ${new Date(doc.reviewed_at).toLocaleString()}` : ''} · Extracted-text SHA-256: {doc.content_sha256 ? `${doc.content_sha256.slice(0, 16)}…` : 'unavailable'}{doc.projection_version ? ` · projection ${doc.projection_version}` : ''}
                    </span>
                    {doc.review_note && <span className="kb-sub">Note: {doc.review_note}</span>}
                  </div>
                  <div className="kb-actions">
                    <button type="button" className="kb-btn" disabled={busy} onClick={() => togglePreview(doc.id)}>
                      {preview?.id === doc.id ? 'Hide' : 'Preview'}
                    </button>
                    {isAdmin && doc.status !== 'published' && (
                      <button
                        type="button"
                        className="kb-btn kb-btn-go"
                        disabled={busy}
                        onClick={() =>
                          void act(doc.id, () => approveKnowledgeDocument(doc.id), `Published "${doc.filename}".`)
                        }
                      >
                        Approve
                      </button>
                    )}
                    {isAdmin && doc.status !== 'rejected' && (
                      <button
                        type="button"
                        className="kb-btn"
                        disabled={busy}
                        onClick={() => setRejecting({ id: doc.id, note: '' })}
                      >
                        {doc.status === 'published' ? 'Unpublish' : 'Reject'}
                      </button>
                    )}
                    <button type="button" className="kb-btn kb-btn-danger" disabled={busy} onClick={() => handleDelete(doc)}>
                      Delete
                    </button>
                  </div>
                </div>

                {rejecting?.id === doc.id && (
                  <div className="kb-reject">
                    <label className="selector grow">
                      <span className="selector-label">Reason (shown to the uploader)</span>
                      <input
                        value={rejecting.note}
                        maxLength={500}
                        onChange={(e) => setRejecting({ id: doc.id, note: e.target.value })}
                        placeholder="e.g. Off-topic, or duplicates existing material"
                      />
                    </label>
                    <button type="button" className="kb-btn kb-btn-danger" onClick={confirmReject}>
                      Confirm
                    </button>
                    <button type="button" className="kb-btn" onClick={() => setRejecting(null)}>
                      Cancel
                    </button>
                  </div>
                )}

                {preview?.id === doc.id && (
                  <pre className="kb-preview" aria-label={`Preview of ${doc.filename}`}>
                    {preview.preview}
                    {preview.characters > preview.preview.length && '\n…'}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
