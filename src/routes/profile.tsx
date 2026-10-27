// The learner's own view of their pattern. Behavioural facts only — what
// they did, never what kind of person they are.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  deleteLearningProfile,
  exportLearningProfile,
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

export function ProfilePage() {
  const [profile, setProfile] = useState<LearningProfileData | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Keep the view resilient to older or partial API responses during schema upgrades.
  const recurringErrors = Array.isArray(profile?.recurring_errors) ? profile.recurring_errors : []
  const weakAlgorithms = Array.isArray(profile?.weak_algorithms) ? profile.weak_algorithms : []
  const strongAlgorithms = Array.isArray(profile?.strong_algorithms) ? profile.strong_algorithms : []

  const load = () => {
    fetchLearningProfile().then(setProfile).catch((e) => setError(getApiErrorMessage(e)))
    fetchSubscriptions().then(setSubs).catch(() => setSubs([]))
  }
  useEffect(load, [])

  const exportProfile = async () => {
    setExporting(true)
    setError(null)
    let url: string | undefined
    try {
      const data = await exportLearningProfile()
      url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'learning-profile.json'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      if (url) {
        const downloadUrl = url
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }
      setExporting(false)
    }
  }

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

      {recurringErrors.length > 0 && (
        <section className="island-shell mb-4 rounded-2xl p-5">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
            Worth practising
          </h2>
          <p className="mb-3 text-xs text-[var(--sea-ink-soft)]">
            Things that have tripped you up more than once.
          </p>
          <ul className="lesson-list">
            {recurringErrors.map((e) => (
              <li key={e.category}>
                <span>{e.lesson}</span>
                <span className="lesson-count">{e.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(weakAlgorithms.length > 0 || strongAlgorithms.length > 0) && (
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
                {weakAlgorithms.map((a) => (
                  <li key={a.algorithm} className="tag-weak">{a.algorithm}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold text-[var(--sea-ink-soft)]">
                Solid
              </h3>
              <ul className="tag-list">
                {strongAlgorithms.map((a) => (
                  <li key={a.algorithm} className="tag-strong">{a.algorithm}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="island-shell mb-4 rounded-2xl p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
          Language subscriptions
        </h2>
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
          Your peppercorns are retained when a subscription ends. Students need
          active language access for learning, chat, reviews, practice and mentor help.
          Hint tiers reset every six weeks for each problem and language.
        </p>
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
            No language subscription yet. Student learning requires an active language subscription; staff access follows their role.
          </p>
        )}
      </section>

      <section className="island-shell rounded-2xl p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--kicker)]">
          Your data
        </h2>
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">
          This profile is built from your submissions and the notes you write
          about your own thinking. Erasing it also deletes saved practice and playground files, checkpoints, test history, strikes and clearing answers. You can export your data first.
          Minimal hint billing records remain so erasing your profile does not reset hint prices.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mini-btn" disabled={exporting} onClick={exportProfile}>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          {confirming ? (
            <>
              <button type="button" className="mini-btn" onClick={erase}>
                Yes, erase learning data
              </button>
              <button type="button" className="mini-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="mini-btn" onClick={() => setConfirming(true)}>
              Erase my learning profile
            </button>
          )}
        </div>
        {confirming && (
          <p className="mt-2 text-xs text-[var(--sea-ink-soft)]">
            Erasing removes the patterns above and the mentor&apos;s ability to
            recall how you reasoned before. Saved practice sessions, workspace files and chat conversations remain.
          </p>
        )}
      </section>
    </main>
  )
}
