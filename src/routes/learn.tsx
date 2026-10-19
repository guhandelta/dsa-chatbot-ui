// Learner hub: courses, source collections and authored practice. Teaching lives at /teach.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchReferenceSubjects, fetchTracks, getApiErrorMessage, setPreferredLanguage, type ReferenceSubject } from '../lib/api'
import { hasToken, useAuth } from '../lib/auth'
import { LANGUAGE_LABELS } from '../lib/languageAccess'
import type { TracksResponse } from '../types'
import { CourseOutline } from '../components/CourseOutline'

export const Route = createFileRoute('/learn')({
  beforeLoad: () => { if (!hasToken()) throw redirect({ to: '/login' }) },
  component: LearnHub,
})

export function LearnHub() {
  const { setUser } = useAuth()
  const [data, setData] = useState<TracksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [references, setReferences] = useState<ReferenceSubject[]>([])
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [referencesLoading, setReferencesLoading] = useState(true)
  useEffect(() => {
    let active = true
    fetchTracks().then((value) => { if (active) setData(value) })
      .catch((e) => { if (active) setError(getApiErrorMessage(e)) })
    fetchReferenceSubjects().then((value) => { if (active) setReferences(value) })
      .catch((e) => { if (active) setReferenceError(getApiErrorMessage(e)) })
      .finally(() => { if (active) setReferencesLoading(false) })
    return () => { active = false }
  }, [])
  const chooseLanguage = async (language: string) => {
    setSaving(true); setError(null)
    try {
      const updated = await setPreferredLanguage(language)
      setUser(updated)
      setData(await fetchTracks())
    } catch (e) { setError(getApiErrorMessage(e)) }
    finally { setSaving(false) }
  }
  const current = data?.preferred_language ?? ''
  const collections = references.filter((item) => item.language === current && item.retrievable_records > 0)
  return <main className="page-wrap px-4 py-8">
    <p className="island-kicker mb-1">Learn</p>
    <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">Your courses and learning library</h1>
    <p className="mb-5 max-w-2xl text-sm text-[var(--sea-ink-soft)]">Choose a language to follow its course outline, read existing sources, or practise authored exercises. Reference collections and graded courses have different coverage.</p>
    {error && <div className="error-banner mb-4" role="alert">{error}</div>}
    <section className="island-shell mb-5 rounded-2xl p-4 sm:p-5" aria-label="Learning language">
      <p className="selector-label mb-2 font-semibold">Your language</p>
      {data?.languages.length === 0 && <p>No languages are available for this account. Students need an active language subscription; instructors need a teaching assignment or uploaded language content.</p>}
      <div className="lang-tabs">{(data?.languages ?? []).map((language) => <button key={language} type="button" disabled={saving}
        aria-pressed={current === language} onClick={() => void chooseLanguage(language)} className={`lang-tab ${current === language ? 'is-active' : ''}`}>
        {LANGUAGE_LABELS[language] ?? (language === 'csharp' ? 'C#' : language)}
      </button>)}</div>
      {!data && !error && <p role="status">Loading your learning options…</p>}
    </section>
    {current && <>
      <CourseOutline key={current} language={current} />
      <section className="island-shell my-5 rounded-2xl p-5" aria-label="Knowledge-base collections">
        <h2 className="mb-2 text-xl font-bold">Explore your trained reference collections</h2>
        <p className="mb-3 text-sm">These sources can support reading and tutoring. A source collection does not by itself provide a graded course, a UI preview, or a circuit simulator.</p>
        {referenceError && <p role="status">Reference collections could not be loaded: {referenceError}</p>}
        {referencesLoading && <p role="status">Loading reference collections…</p>}
        {collections.length === 0 && !referenceError && !referencesLoading && <p className="text-sm">No readable reference collections are currently listed for this language.</p>}
        <div className="track-grid">{collections.map((item) => <article key={item.id} className="rounded-xl border border-[var(--line)] p-4">
          <h3 className="font-semibold">{item.id.replaceAll('-', ' ')}</h3>
          <p className="my-2 text-sm">{item.retrievable_records} readable references · {item.records} source records</p>
          <Link to="/chat" search={{ mode: 'chat', language: current, subject: item.id }} className="mini-btn">Study this collection</Link>
        </article>)}</div>
      </section>
      <h2 className="mb-3 text-xl font-bold">Authored lessons and practice</h2>
      <p className="mb-4 text-sm">These counts cover published lesson and exercise files, rather than every reference in the knowledge base. Availability varies by language.</p>
      <div className="track-grid mb-8">{(data?.tracks ?? []).map((track) => <article key={track.track} className="island-shell track-card rounded-2xl p-5">
        <h3 className="mb-1 text-lg font-bold">{track.label}</h3>
        <p className="mb-3 text-sm">{track.blurb}</p>
        <p className="mb-4 text-xs">{track.count} authored {track.count === 1 ? 'item' : 'items'}</p>
        <div className="flex gap-2">
          <Link to="/track/$track" params={{ track: track.track }} search={{ mode: 'browse' }} className="track-btn">Explore lessons</Link>
          <Link to="/track/$track" params={{ track: track.track }} search={{ mode: 'practice' }} className="track-btn track-btn-alt">Practice</Link>
        </div>
      </article>)}</div>
    </>}
  </main>
}
