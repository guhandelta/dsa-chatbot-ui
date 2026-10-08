// Admin — assign the instructor role so trusted people can train the chatbot.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { fetchUsers, getApiErrorMessage, setUserRole } from '../lib/api'
import { hasToken, useAuth } from '../lib/auth'
import type { Role, User } from '../types'

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    if (!hasToken()) throw redirect({ to: '/login' })
  },
  component: AdminPage,
})

function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  if (user && user.role !== 'admin') {
    return (
      <main className="page-wrap px-4 py-14">
        <section className="island-shell auth-card rounded-2xl p-6 text-center">
          <h1 className="display-title mb-2 text-2xl font-bold text-[var(--sea-ink)]">
            Admins only
          </h1>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Role management is restricted to administrators.
          </p>
        </section>
      </main>
    )
  }

  const changeRole = async (id: string, role: Role) => {
    setBusy(id)
    setError(null)
    try {
      const updated = await setUserRole(id, role)
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="page-wrap px-4 py-8">
      <p className="island-kicker mb-1">Admin</p>
      <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">
        People &amp; roles
      </h1>
      <p className="mb-5 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
        Instructors can add problems to the knowledge base. Promote only people you
        trust to author training content.
      </p>

      {error && <div className="error-banner mb-4">{error}</div>}

      <section className="island-shell rounded-2xl p-4 sm:p-6">
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <div>
                <span className="user-email">{u.email}</span>
                <span className={`role-chip role-${u.role}`}>{u.role}</span>
              </div>
              <div className="flex gap-2">
                {u.id === user?.id ? (
                  <span className="text-xs text-[var(--sea-ink-soft)]">that's you</span>
                ) : (
                  <>
                    {u.role !== 'instructor' && (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        onClick={() => changeRole(u.id, 'instructor')}
                        className="mini-btn"
                      >
                        Make instructor
                      </button>
                    )}
                    {u.role !== 'student' && (
                      <button
                        type="button"
                        disabled={busy === u.id}
                        onClick={() => changeRole(u.id, 'student')}
                        className="mini-btn"
                      >
                        Revoke
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {users.length === 0 && !error && (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading people…</p>
        )}
      </section>
    </main>
  )
}
