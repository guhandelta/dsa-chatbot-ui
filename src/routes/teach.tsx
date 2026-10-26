// Training section — instructors and admins only. Submit a problem with any
// subset of solutions; the pipeline reviews, corrects, completes all six
// languages, executes them, and publishes only if everything verifies.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { ValidationReportView } from '../components/ValidationReportView'
import { KnowledgeUploadPanel } from '../components/KnowledgeUploadPanel'
import { ProviderSelector } from '../components/ProviderSelector'
import {
  fetchTrainingStatus,
  getApiErrorMessage,
  submitTraining,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { canAccessTeaching, requireTeachingAccess } from '../lib/routeAccess'
import type { Provider, TrainResult, TrainingStatus } from '../types'

const LANGS = [
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'java', label: 'Java' },
  { key: 'cpp', label: 'C++' },
  { key: 'c', label: 'C' },
  { key: 'rust', label: 'Rust' },
]

export const Route = createFileRoute('/teach')({
  beforeLoad: requireTeachingAccess,
  component: TeachPage,
})

export function TeachPage() {
  const { user, initializing } = useAuth()
  const canTrain = canAccessTeaching(user)
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [problemId, setProblemId] = useState('')
  const [problem, setProblem] = useState('')
  const [activeLang, setActiveLang] = useState('python')
  const [solutions, setSolutions] = useState<Record<string, string>>({})
  const [provider, setProvider] = useState<Provider>('gemini')
  const [result, setResult] = useState<TrainResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!canTrain) return
    fetchTrainingStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [canTrain])

  // Role gate — the API enforces this too; this is just a friendlier message.
  if (initializing) {
    return <main className="page-wrap px-4 py-14"><p role="status">Checking training access…</p></main>
  }
  if (!canTrain) {
    return (
      <main className="page-wrap px-4 py-14">
        <section className="island-shell auth-card rounded-2xl p-6 text-center">
          <p className="island-kicker mb-2">Restricted</p>
          <h1 className="display-title mb-3 text-2xl font-bold text-[var(--sea-ink)]">
            Training is for admins and instructors
          </h1>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            Ask an admin to grant you the instructor role if you should be adding
            problems to the knowledge base.
          </p>
        </section>
      </main>
    )
  }

  const handleSubmit = async () => {
    if (loading) return
    if (!/^[a-z0-9][a-z0-9-]*$/.test(problemId)) {
      setError('Problem ID must be lowercase letters, digits, and hyphens (e.g. two-sum).')
      return
    }
    if (problem.trim().length < 5) {
      setError('Describe the problem — a statement or even just the name and a sentence.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      // Only send languages the instructor actually filled in
      const filled = Object.fromEntries(
        Object.entries(solutions).filter(([, v]) => v && v.trim().length > 0),
      )
      setResult(await submitTraining({ problemId, problem, solutions: filled, provider }))
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <p className="island-kicker mb-0">Teach</p>
        <Link
          to="/registry"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
        >
          View Tech Board &amp; Registry &rarr;
        </Link>
      </div>
      <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)]">
        Teach the chatbot a new problem
      </h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--sea-ink-soft)]">
        Submit a problem with as much or as little as you have. Missing language
        solutions get written for you, mistakes are corrected and reported, and
        every implementation is executed before anything is published.
      </p>

      {status && (
        <div className="vr-toolchains mb-5">
          <strong>This machine can verify:</strong>{' '}
          {status.executed_languages.join(', ') || 'nothing'} (executed against tests)
          {status.compiled_languages.length > 0 &&
            `; ${status.compiled_languages.join(', ')} (compiled)`}
          {status.unavailable.length > 0 && (
            <span className="vr-warn">
              {' '}— no toolchain for {status.unavailable.join(', ')}, so those are
              reviewed but marked unverified.
            </span>
          )}
        </div>
      )}

      {user && <KnowledgeUploadPanel isAdmin={user.role === 'admin'} />}

      <section className="island-shell mt-6 rounded-2xl p-4 sm:p-6">
        <div className="controls mb-3">
          <label className="selector grow">
            <span className="selector-label">Problem ID (slug)</span>
            <input
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
              placeholder="e.g. valid-parentheses"
            />
          </label>
          <ProviderSelector value={provider} onChange={setProvider} />
        </div>

        <label className="selector mb-3 block">
          <span className="selector-label">Problem statement</span>
          <textarea
            className="train-textarea"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={5}
            placeholder="Paste the full problem statement, or just describe it — e.g. 'Valid Parentheses (LC 20): given a string of brackets, decide whether they're correctly closed and nested.'"
          />
        </label>

        <div className="lang-tabs mb-2">
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setActiveLang(l.key)}
              className={`lang-tab ${activeLang === l.key ? 'is-active' : ''} ${
                solutions[l.key]?.trim() ? 'has-code' : ''
              }`}
            >
              {l.label}
              {solutions[l.key]?.trim() ? ' ●' : ''}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-[var(--sea-ink-soft)]">
          Optional — fill in any languages you have. Empty ones are written for you.
        </p>

        <div className="editor-frame">
          <Editor
            height="320px"
            language={activeLang === 'cpp' ? 'cpp' : activeLang}
            value={solutions[activeLang] ?? ''}
            onChange={(val) =>
              setSolutions((prev) => ({ ...prev, [activeLang]: val || '' }))
            }
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>

        {error && <div className="error-banner mt-3">{error}</div>}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={loading} className="primary-btn">
            {loading ? 'Reviewing, completing & executing…' : 'Submit for verification'}
          </button>
          <span className="cost-note m-0">
            Takes up to a minute — solutions are generated and then actually run.
          </span>
        </div>
      </section>

      {result && <ValidationReportView result={result} />}

    </main>
  )
}
