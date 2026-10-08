// The learner's own view of their pattern. Behavioural facts only — what
// they did, never what kind of person they are.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  deleteLearningProfile,
  fetchLearningProfile,
  fetchSubscriptions,
  getApiErrorMessage,
} from '../lib/api'
import { hasToken } from '../lib/auth'
import type { LearningProfileData, Subscription } from '../types'

export const Route = createFileRoute('/profile')({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: '/login' })
  },
  component: ProfilePage,
})

function ProfilePage() {
  const [profile, setProfile] = useState<LearningProfileData | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const load = () => {
    fetchLearningProfile().then(setProfile).catch((e) => setError(getApiErrorMessage(e)))
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
  }
  useEffect(load, [])

  const erase = async () => {
    try {
      await deleteLearningProfile()
      setConfirming(false)
      load()
    } catch (e) {
      setError(getApiErrorMessage(e))
    }
  }

  return (
    <main className="page-wrap px-4 py-8">
      <p className="island-kicker mb-1">Your progress</p>
      <h1 className="display-title mb-5 text-3xl font-bold text-[var(--sea-ink)]">
        Patterns in your practice
      </h1>

      {error && <div className="error-banner mb-4">{error}</div>}

      <section className="island-shell mb-4 rounded-2xl p-5">
        {profile && profile.total_attempts > 0 ? (
          <>
            <p className="mb-4 text-base text-[var(--sea-ink)]">{profile.summary}</p>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-value">{profile.solved}</span>
                <span className="stat-label">solved</span>
              </div>
              <div className="stat">
                <span className="stat-value">{profile.total_attempts}</span>
                <span className="stat-label">attempts</span>
              </div>
              <div className="stat">
                <span className="stat-value">{profile.avg_hint_tier || '—'}</span>
                <span className="stat-label">avg hint tier</span>
              </div>
            </div>
          </>
        ) : (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Solve a few problems and patterns will start showing up here.
          </p>
        )}
      </section>

      {profile && profile.recurring_errors.length > 0 && (
        <section className="island-shell mb-4 rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            Worth practising
          </h2>
          <p className="mb-3 text-xs text-[var(--sea-ink-soft)]">
            Things that have tripped you up more than once.
          </p>
          <ul className="lesson-list">
            {profile.recurring_errors.map((e) => (
              <li key={e.category}>
                <span>{e.lesson}</span>
                <span className="lesson-count">{e.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile && (profile.weak_algorithms.length > 0 || profile.strong_algorithms.length > 0) && (
        <section className="island-shell mb-4 rounded-2xl p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            By technique
          </h2>
          <div className="algo-cols">
            <div>
              <h3 className="mb-2 text-xs font-bold text-[var(--sea-ink-soft)]">
                Still landing
              </h3>
              <ul className="tag-list">
                {profile.weak_algorithms.map((a) => (
                  <li key={a.algorithm} className="tag-weak">{a.algorithm}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold text-[var(--sea-ink-soft)]">
                Solid
              </h3>
              <ul className="tag-list">
                {profile.strong_algorithms.map((a) => (
                  <li key={a.algorithm} className="tag-strong">{a.algorithm}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="island-shell mb-4 rounded-2xl p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
          Mentor subscriptions
        </h2>
        {subs.length ? (
          <ul className="sub-list">
            {subs.map((s) => (
              <li key={s.id}>
                <span className="user-email">{s.language}</span>
                <span className={`role-chip role-${s.status === 'active' ? 'instructor' : 'student'}`}>
                  {s.status}
                </span>
                <span className="text-xs text-[var(--sea-ink-soft)]">
                  until {new Date(s.expires_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            No mentor subscription yet. Review, chat, and practice work without one.
          </p>
        )}
      </section>

      <section className="island-shell rounded-2xl p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
          Your data
        </h2>
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
          This profile is built from your submissions and the notes you write
          about your own thinking. You can export or erase it at any time.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/mentor/profile/export" className="mini-btn no-underline">
            Export
          </a>
          {confirming ? (
            <>
              <button type="button" className="mini-btn" onClick={erase}>
                Yes, erase everything
              </button>
              <button type="button" className="mini-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="mini-btn" onClick={() => setConfirming(true)}>
              Erase my history
            </button>
          )}
        </div>
        {confirming && (
          <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">
            Erasing removes the patterns above and the mentor&apos;s ability to
            recall how you reasoned before.
          </p>
        )}
      </section>
    </main>
  )
}
