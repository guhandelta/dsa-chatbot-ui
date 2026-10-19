// The hub: pick a track, then Learn or Practice within it.
// Language is chosen once here and saved to the profile.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  fetchTracks,
  getApiErrorMessage,
  setPreferredLanguage,
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
  const { setUser } = useAuth()
  const [data, setData] = useState<TracksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

    </main>
  )
}
