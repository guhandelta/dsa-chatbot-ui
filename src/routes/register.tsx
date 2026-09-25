import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getApiErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

export const Route = createFileRoute('/register')({ component: RegisterPage })

function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (submitting) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await register(email, password)
      navigate({ to: '/chat' })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-14">
      <section className="island-shell auth-card rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Get started</p>
        <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">
          Create your account
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          New accounts start with 50 peppercorns on the house.
        </p>
        {error && <div className="error-banner mb-4">{error}</div>}
        <div className="auth-fields">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            <span>Password (8+ characters)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
          </label>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="primary-btn">
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>
        </div>
        <p className="mt-5 text-sm text-[var(--sea-ink-soft)]">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[var(--lagoon-deep)]">
            Log in
          </Link>
        </p>
      </section>
    </main>
  )
}
