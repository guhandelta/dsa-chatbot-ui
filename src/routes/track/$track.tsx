// One track, two modes. Learn = RAG chat scoped to this track.
// Practice = pick an item and solve it, or drill an algorithm by difficulty.
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ChatWindow } from '../../components/ChatWindow'
import { ProviderSelector } from '../../components/ProviderSelector'
import {
  fetchAlgorithmTags,
  fetchTrackItems,
  getApiErrorMessage,
} from '../../lib/api'
import { hasToken, useAuth } from '../../lib/auth'
import type { ContentMeta, Mode, Provider, Track } from '../../types'

const LABEL: Record<string, string> = {
  language: 'Language Fundamentals',
  dsa: 'DSA Problems',
  algorithm: 'Algorithms',
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

export const Route = createFileRoute('/track/$track')({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: '/login' })
  },
  validateSearch: (search: Record<string, unknown>): { mode: Mode } => ({
    mode: search.mode === 'practice' ? 'practice' : 'learn',
  }),
  component: TrackPage,
})

function TrackPage() {
  const { track } = Route.useParams()
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [items, setItems] = useState<ContentMeta[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [algorithm, setAlgorithm] = useState<string>('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [focus, setFocus] = useState<ContentMeta | null>(null)
  const [provider, setProvider] = useState<Provider>('openai')
  const [error, setError] = useState<string | null>(null)

  const language = user?.preferred_language ?? 'python'

  useEffect(() => {
    setFocus(null)
    fetchTrackItems(track, {
      difficulty: difficulty || undefined,
      algorithm: algorithm || undefined,
    })
      .then(setItems)
      .catch((e) => setError(getApiErrorMessage(e)))
    if (track === 'algorithm') {
      fetchAlgorithmTags().then(setTags).catch(() => setTags([]))
    }
  }, [track, difficulty, algorithm])

  const switchMode = (next: Mode) =>
    navigate({ to: '/track/$track', params: { track }, search: { mode: next } })

  return (
    <main className="page-wrap px-4 py-8">
      <Link to="/learn" className="text-xs font-semibold text-[var(--lagoon-deep)]">
        ← All tracks
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">{LABEL[track] ?? track}</p>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">
            {mode === 'learn' ? 'Learn' : 'Practice'}
          </h1>
        </div>
        <div className="mode-toggle">
          <button
            type="button"
            onClick={() => switchMode('learn')}
            className={`lang-tab ${mode === 'learn' ? 'is-active' : ''}`}
          >
            Learn
          </button>
          <button
            type="button"
            onClick={() => switchMode('practice')}
            className={`lang-tab ${mode === 'practice' ? 'is-active' : ''}`}
          >
            Practice
          </button>
        </div>
      </div>

      {error && <div className="error-banner mb-4">{error}</div>}

      {/* Filters — algorithm track drills a technique across difficulties */}
      <div className="controls mb-4">
        {track === 'algorithm' && (
          <label className="selector">
            <span className="selector-label">Algorithm</span>
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              <option value="">All</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        {track !== 'language' && (
          <label className="selector">
            <span className="selector-label">Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Any</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
        )}
        {mode === 'learn' && <ProviderSelector value={provider} onChange={setProvider} />}
        <span className="cost-note m-0 self-center">
          Coding in {language} — change it on the tracks page.
        </span>
      </div>

      <div className="track-layout">
        <aside className="island-shell rounded-2xl p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            {items.length} {items.length === 1 ? 'topic' : 'topics'}
          </h2>
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setFocus(item)}
                  className={`item-btn ${focus?.id === item.id ? 'is-active' : ''}`}
                >
                  <span className="item-title">{item.title}</span>
                  <span className={`diff-chip diff-${item.difficulty.toLowerCase()}`}>
                    {item.difficulty}
                  </span>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-[var(--sea-ink-soft)]">
                Nothing here yet — a teacher can add content in the Train section.
              </li>
            )}
          </ul>
        </aside>

        <section>
          {mode === 'learn' ? (
            <ChatWindow
              key={`${track}-${focus?.id ?? 'all'}`}
              provider={provider}
              language={language}
              track={track as Track}
              focusId={focus?.id}
              chatCost={1}
            />
          ) : (
            <div className="island-shell rounded-2xl p-5">
              {focus ? (
                <>
                  <h2 className="mb-1 text-lg font-bold text-[var(--sea-ink)]">
                    {focus.title}
                  </h2>
                  <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
                    Solve it in {language}, then submit for review.
                  </p>
                  <Link
                    to="/practice"
                    search={{ problem: focus.id }}
                    className="primary-btn inline-block no-underline"
                  >
                    Open in editor
                  </Link>
                </>
              ) : (
                <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                  Pick a topic on the left to practise it.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
