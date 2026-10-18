// The hub: pick a track, then Learn or Practice within it.
// Language is chosen once here and saved to the profile.
// Also allows uploading documents (.txt, .doc, .docx, .pdf, .md) to train the app's knowledge base.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  fetchTracks,
  getApiErrorMessage,
  setPreferredLanguage,
  trainKnowledgeBaseDocument,
  type LearnTrainResult,
} from '../lib/api'
import { hasToken, useAuth } from '../lib/auth'
import { LANGUAGE_LABELS } from '../lib/languageAccess'
import type { TracksResponse } from '../types'


export const Route = createFileRoute('/learn')({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: '/login' })
  },
  component: LearnHub,
})

function LearnHub() {
  const { user, setUser } = useAuth()
  const [data, setData] = useState<TracksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Document training state
  const [file, setFile] = useState<File | null>(null)
  const [track, setTrack] = useState('custom')
  const [referenceLanguage, setReferenceLanguage] = useState(user?.preferred_language === 'java' ? 'java' : 'javascript')
  const [pastedText, setPastedText] = useState('')
  const [useTextInput, setUseTextInput] = useState(false)
  const [training, setTraining] = useState(false)
  const [trainResult, setTrainResult] = useState<LearnTrainResult | null>(null)
  const [trainError, setTrainError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetchTracks()
      .then(setData)
      .catch((e) => setError(getApiErrorMessage(e)))
  }, [])

  const chooseLanguage = async (lang: string) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await setPreferredLanguage(lang)
      setUser(updated)
      setData(await fetchTracks())
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0]
      const ext = dropped.name.slice(dropped.name.lastIndexOf('.')).toLowerCase()
      if (['.txt', '.doc', '.docx', '.pdf', '.md'].includes(ext)) {
        setFile(dropped)
        setTrainError(null)
      } else {
        setTrainError(`Unsupported format '${ext}'. Allowed: .txt, .doc, .docx, .pdf, .md`)
      }
    }
  }

  const handleTrainSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file && !pastedText.trim()) {
      setTrainError('Please select a document (.txt, .doc, .docx, .pdf, .md) or paste text.')
      return
    }

    setTraining(true)
    setTrainError(null)
    setTrainResult(null)

    try {
      const result = await trainKnowledgeBaseDocument({
        file: file ?? undefined,
        text: !file && pastedText.trim() ? pastedText.trim() : undefined,
        track,
        language: referenceLanguage,
      })
      setTrainResult(result)
      setFile(null)
      setPastedText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setTrainError(getApiErrorMessage(err))
    } finally {
      setTraining(false)
    }
  }

  const current = data?.preferred_language ?? ''

  return (
    <main className="page-wrap px-4 py-8">
      <p className="island-kicker mb-1">Your path</p>
      <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">
        What do you want to work on?
      </h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
        Choose an available language. Start with language foundations,
        or go directly to DSA workouts. Learn at your own pace.
      </p>

      {error && <div className="error-banner mb-4">{error}</div>}

      {/* Language Selector */}
      <section className="island-shell mb-5 rounded-2xl p-4 sm:p-5">
        <span className="selector-label mb-2 block font-semibold text-[var(--sea-ink)]">
          Your language
        </span>
        {data && data.languages.length === 0 && <p>No languages are available yet. Students need an active language subscription; instructors need a teaching assignment or uploaded language content.</p>}
        <div className="lang-tabs">
          {(data?.languages ?? []).map((l) => (
            <button
              key={l}
              type="button"
              disabled={saving}
              onClick={() => chooseLanguage(l)}
              className={`lang-tab ${current === l ? 'is-active' : ''}`}
            >
              {LANGUAGE_LABELS[l] ?? l}
            </button>
          ))}
        </div>
      </section>

      {current && <Link to="/chat" className="primary-btn mb-5 inline-block">Open language tutor and reference library</Link>}

      {/* Tracks Grid */}
      <div className="track-grid mb-8">
        {(data?.tracks ?? []).map((t) => (
          <article key={t.track} className="island-shell track-card rounded-2xl p-5">
            <h2 className="mb-1 text-lg font-bold text-[var(--sea-ink)]">{t.label}</h2>
            <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">{t.blurb}</p>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--kicker)]">
              {t.count} {t.count === 1 ? 'item' : 'items'}
            </p>
            <div className="flex gap-2">
              <Link
                to="/track/$track"
                params={{ track: t.track }}
                search={{ mode: 'browse' }}
                className="track-btn"
              >
                Explore lessons
              </Link>
              <Link
                to="/track/$track"
                params={{ track: t.track }}
                search={{ mode: 'practice' }}
                className="track-btn track-btn-alt"
              >
                Practice
              </Link>
            </div>
          </article>
        ))}
        {!data && !error && (
          <p className="text-sm text-[var(--sea-ink-soft)]">Loading tracks…</p>
        )}
      </div>

      {/* Knowledge Base Training Hub */}
      {user && user.role !== 'student' && (
      <section className="island-shell rounded-2xl p-5 sm:p-6 shadow-sm border border-[var(--sand-dark,rgba(0,0,0,0.08))]">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--sand-dark,rgba(0,0,0,0.08))] pb-4">
          <div>
            <p className="island-kicker mb-1">Knowledge Base</p>
            <h2 className="text-xl font-bold text-[var(--sea-ink)]">
              Train Tutor with Your Documents
            </h2>
            <p className="text-xs text-[var(--sea-ink-soft)] mt-1">
              Upload course notes, cheatsheets, or textbooks to ground the AI tutor in your custom material.
            </p>
          </div>
          <div className="flex gap-1 items-center flex-wrap">
            {['.txt', '.doc', '.docx', '.pdf', '.md'].map((ext) => (
              <span
                key={ext}
                className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[var(--sand,#f4ede4)] text-[var(--sea-ink-soft)]"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>

        {trainError && <div className="error-banner mb-4">{trainError}</div>}

        {trainResult && (
          <div className="mb-4 rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-lg">✓</span>
              <span>{trainResult.review_status === 'pending' ? 'Document awaiting approval' : trainResult.retrieval_status === 'available' ? 'Reference excerpts available' : 'Document saved for reference review'}</span>
            </div>
            <p className="text-sm mt-1">{trainResult.message}</p>
            <p className="text-sm mt-1">Only approved reference excerpts are available in chat. Code and answer sections are withheld.</p>
            {trainResult.retrieval_status === 'language_review_required' && <p className="text-sm mt-1">Choose a language before this material can be retrieved.</p>}
            {trainResult.retrieval_status === 'no_reference_text' && <p className="text-sm mt-1">No reference excerpts passed the filter. Review the source content.</p>}
            <div className="mt-2 flex gap-4 text-xs text-emerald-800">
              <span>File: <strong>{trainResult.filename}</strong></span>
              <span>Chunks Indexed: <strong>{trainResult.chunks_trained}</strong></span>
              <span>Track: <strong>{trainResult.track}</strong></span>
            </div>
          </div>
        )}

        <form onSubmit={handleTrainSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="reference-language" className="block text-xs font-semibold uppercase text-[var(--kicker)] mb-1">Reference language</label>
              <select id="reference-language" value={referenceLanguage} onChange={(e) => setReferenceLanguage(e.target.value)}>
                {(data?.training_languages ?? []).map(language => <option key={language} value={language}>{LANGUAGE_LABELS[language] ?? language}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-[var(--kicker)] mb-1">
                Target Track
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--sand-dark,rgba(0,0,0,0.15))] bg-[var(--surface,white)] text-[var(--sea-ink)]"
              >
                <option value="custom">Custom Notes (General RAG)</option>
                <option value="dsa">DSA Track</option>
                <option value="algorithm">Algorithms Track</option>
                <option value="language">Language Track</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setUseTextInput(!useTextInput)
                  setFile(null)
                  setTrainError(null)
                }}
                className="text-xs font-semibold text-[var(--lagoon-deep)] hover:underline mb-2"
              >
                {useTextInput ? '← Switch to Document File Upload' : 'Paste Raw Text / Markdown Instead →'}
              </button>
            </div>
          </div>

          {!useTextInput ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-[var(--lagoon-deep)] bg-sky-50'
                  : 'border-[var(--sand-dark,rgba(0,0,0,0.18))] hover:border-[var(--lagoon-deep)] bg-[var(--surface,white)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.doc,.docx,.pdf,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0])
                    setTrainError(null)
                  }
                }}
                className="hidden"
              />
              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--sea-ink)]">
                    Selected File: {file.name}
                  </p>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    {(file.size / 1024).toFixed(1)} KB — Click or drag to replace
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--sea-ink)]">
                    Drop your document here or click to browse
                  </p>
                  <p className="text-xs text-[var(--sea-ink-soft)]">
                    Supports .txt, .doc, .docx, .pdf, or .md
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold uppercase text-[var(--kicker)] mb-1">
                Paste Content / Markdown Notes
              </label>
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="# Dynamic Programming Notes&#10;Memoization stores previous results..."
                className="w-full rounded-xl p-3 text-sm font-mono border border-[var(--sand-dark,rgba(0,0,0,0.15))] bg-[var(--surface,white)] text-[var(--sea-ink)]"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {(file || pastedText) && (
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPastedText('')
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="px-4 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={training || (!file && !pastedText.trim())}
              className="primary-btn px-6 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {training ? 'Indexing & Training Knowledge Base…' : 'Train Knowledge Base'}
            </button>
          </div>
        </form>
      </section>
      )}
    </main>
  )
}
