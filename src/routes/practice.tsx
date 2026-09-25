// Practice mode: code editor + solution submission + structured analysis.
// Auth-gated; each analysis costs peppercorns.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { EvidencePanel } from '../components/EvidencePanel'
import { MentorPanel } from '../components/MentorPanel'
import { LanguageSelector } from '../components/LanguageSelector'
import { ProviderSelector } from '../components/ProviderSelector'
import { ProblemPicker } from '../components/ProblemPicker'
import { getApiErrorMessage, submitSolution } from '../lib/api'
import { hasToken, useAuth } from '../lib/auth'
import type { AnalysisResult, Evidence, Provider } from '../types'

const ANALYZE_COST = 5

export const Route = createFileRoute('/practice')({
  beforeLoad: () => {
    if (!hasToken()) {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: (search: Record<string, unknown>): { problem?: string } => ({
    problem: typeof search.problem === 'string' ? search.problem : undefined,
  }),
  component: PracticePage,
})

function PracticePage() {
  const [code, setCode] = useState('# Write your solution here\n')
  const [provider, setProvider] = useState<Provider>('openai')
  const [language, setLanguage] = useState('python')
  const { problem: preselected } = Route.useSearch()
  const [problemId, setProblemId] = useState(preselected ?? '')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setBalance } = useAuth()

  const handleSubmit = async () => {
    if (loading || !code.trim() || !problemId.trim()) return
    setLoading(true)
    setError(null)
    try {
      // Send code to backend for RAG-powered analysis
      const result = await submitSolution({
        problemId: problemId.trim(),
        userCode: code,
        language,
        provider,
      })
      setAnalysis(result.analysis)
      setEvidence((result as unknown as { evidence?: Evidence }).evidence ?? null)
      setBalance(result.peppercorns_remaining)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-8">
      <p className="island-kicker mb-1">Practice mode</p>
      <h1 className="display-title mb-4 text-3xl font-bold text-[var(--sea-ink)]">
        Submit a solution for review
      </h1>

      <div className="practice-layout island-shell rounded-2xl p-4 sm:p-6">
        <div className="controls mb-3">
          <ProblemPicker value={problemId} onChange={setProblemId} />
          <ProviderSelector value={provider} onChange={setProvider} />
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>

        {/* Monaco editor for code input — same engine as VS Code */}
        <div className="editor-frame">
          <Editor
            height="400px"
            language={language}
            value={code}
            onChange={(val) => setCode(val || '')}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 14 }}
          />
        </div>

        {error && <div className="error-banner mt-3">{error}</div>}

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={handleSubmit} disabled={loading} className="primary-btn">
            {loading ? 'Analyzing…' : 'Submit Solution'}
          </button>
          <span className="cost-note m-0">Costs {ANALYZE_COST} peppercorns per analysis.</span>
        </div>
      </div>

      {/* Socratic mentor sits alongside the editor — available while they
          are still thinking, not only after they submit */}
      <div className="mt-4">
        <MentorPanel
          problemId={problemId}
          language={language}
          currentCode={code}
          provider={provider}
        />
      </div>

      {/* Evidence first, then the written review — so the learner sees the
          facts before the interpretation of them */}
      {evidence && <EvidencePanel evidence={evidence} />}
      {analysis && <AnalysisPanel result={analysis} />}
    </main>
  )
}
