// The hub: pick a track, then Learn or Practice within it.
// Language is chosen once here and saved to the profile.
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchTracks, getApiErrorMessage, setPreferredLanguage } from '../lib/api'
import { hasToken, useAuth } from '../lib/auth'
import type { TracksResponse } from '../types'

const LANG_LABEL: Record<string, string> = {
  python: 'Python', javascript: 'JavaScript', java: 'Java',
  cpp: 'C++', c: 'C', rust: 'Rust',
}

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

  useEffect(() => {
    fetchTracks().then(setData).catch((e) => setError(getApiErrorMessage(e)))
  }, [])

  const chooseLanguage = async (lang: string) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await setPreferredLanguage(lang)
      setUser(updated)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const current = user?.preferred_language ?? data?.preferred_language ?? 'python'

  return (
    <main className="page-wrap px-4 py-8">
      <p className="island-kicker mb-1">Your path</p>
      <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">
        What do you want to work on?
      </h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
        Three tracks, each with a Learn side and a Practice side. Your language
        choice applies everywhere.
      </p>

      {error && <div className="error-banner mb-4">{error}</div>}

      <section className="island-shell mb-5 rounded-2xl p-4 sm:p-5">
        <span className="selector-label mb-2 block">Your language</span>
        <div className="lang-tabs">
          {(data?.languages ?? Object.keys(LANG_LABEL)).map((l) => (
            <button
              key={l}
              type="button"
              disabled={saving}
              onClick={() => chooseLanguage(l)}
              className={`lang-tab ${current === l ? 'is-active' : ''}`}
            >
              {LANG_LABEL[l] ?? l}
            </button>
          ))}
        </div>
      </section>

      <div className="track-grid">
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
                search={{ mode: 'learn' }}
                className="track-btn"
              >
                Learn
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
