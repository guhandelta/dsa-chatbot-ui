import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getApiErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!email || !password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
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
        <p className="island-kicker mb-2">Welcome back</p>
        <h1 className="display-title mb-6 text-3xl font-bold text-[var(--sea-ink)]">Log in</h1>
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
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
          </label>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="primary-btn">
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </div>
        <p className="mt-5 text-sm text-[var(--sea-ink-soft)]">
          No account yet?{' '}
          <Link to="/register" className="font-semibold text-[var(--lagoon-deep)]">
            Sign up and get 50 peppercorns
          </Link>
        </p>
      </section>
    </main>
  )
}
