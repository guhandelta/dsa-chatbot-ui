// The Study Room: a coach tied to where the learner is in their path, with
// five modes plus the open tutor. Auth-gated. The URL stays /chat.
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { isAxiosError } from 'axios'
import { getApiErrorMessage } from '../../lib/api'
import { LanguageSelector } from '../../components/LanguageSelector'
import { ProviderSelector } from '../../components/ProviderSelector'
import { OpenChat } from '../../components/study/OpenChat'
import { StudyWorkspace } from '../../components/study/StudyWorkspace'
import { hasToken, useAuth } from '../../lib/auth'
import { useLanguageAccess } from '../../lib/languageAccess'
import type { StudyMode } from '../../lib/studyApi'
import type { Provider } from '../../types'

export const STUDY_MODES: { id: StudyMode; label: string; blurb: string }[] = [
  { id: 'explain', label: 'Explain', blurb: 'Learn the current concept: a mental model, a small worked example, and a common pitfall. Ask why; save a takeaway.' },
  { id: 'quiz', label: 'Quiz me', blurb: 'A short mixed-format quiz, graded on the server.' },
  { id: 'debug', label: 'Debug with me', blurb: 'Investigate code for your current topic: trace its behavior or find a defect with guided questions.' },
  { id: 'compare', label: 'JavaScript vs TypeScript', blurb: 'Understand runtime JavaScript versus TypeScript’s static checks, type narrowing, and migration traps through the same example.' },
  { id: 'next', label: 'What next?', blurb: 'Your progress dashboard: one recommended action and its reason, weak spots to revisit, and saved notes.' },
  { id: 'chat', label: 'Open chat', blurb: 'The free-form tutor and reference collections.' },
]

export function parseSearch(search: Record<string, unknown>): { mode?: StudyMode; focus?: string; language?: string; subject?: string } {
  return {
    ...(STUDY_MODES.some((m) => m.id === search.mode) ? { mode: search.mode as StudyMode } : {}),
    ...(typeof search.focus === 'string' && search.focus ? { focus: search.focus } : {}),
    ...(typeof search.language === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(search.language) ? { language: search.language } : {}),
    ...(typeof search.subject === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(search.subject) ? { subject: search.subject } : {}),
  }
}

export const Route = createFileRoute('/chat/')({
  beforeLoad: () => {
    if (!hasToken()) {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: parseSearch,
  component: StudyRoomRoute,
})

function StudyRoomRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  return <ChatPage initialMode={search.mode ?? 'explain'} initialFocus={search.focus} initialLanguage={search.language} initialSubject={search.subject}
    onNavigate={(mode, focus, subject) => void navigate({ to: '/chat', search: { mode, ...(focus ? { focus } : {}), ...(subject ? { subject } : {}), ...(search.language ? { language: search.language } : {}) } })} />
}

function languageFromFocus(focus?: string): string | undefined {
  const parts = focus?.split(':') ?? []
  if (parts.length === 3 && parts[0] === 'explain') return parts[1]
  if (parts.length === 2 && /^(?:stage-\d+|module-[a-z0-9-]+)$/.test(parts[1])) return parts[0]
  return undefined
}

interface PageProps {
  initialMode?: StudyMode
  initialFocus?: string
  initialLanguage?: string
  initialSubject?: string
  onNavigate?: (mode: StudyMode, focus?: string, subject?: string) => void
}

export function ChatPage({ initialMode = 'explain', initialFocus, initialLanguage, initialSubject, onNavigate }: PageProps) {
  const [provider, setProvider] = useState<Provider>('gemini')
  const { user } = useAuth()
  const student = user?.role === 'student'
  // A path node id ("python:stage-07") carries its language, so a deep link
  // opens in that language rather than the account's preferred one.
  const [language, setLanguage] = useState(languageFromFocus(initialFocus) ?? initialLanguage ?? user?.preferred_language ?? '')
  const [mode, setMode] = useState<StudyMode>(initialMode)
  const [focus, setFocus] = useState<string | undefined>(initialFocus)
  const [referenceSubject, setReferenceSubject] = useState(initialSubject)
  useEffect(() => { setReferenceSubject(initialSubject) }, [initialSubject])
  // Back/forward navigation updates route props without remounting the page.
  useEffect(() => {
    setMode(initialMode)
    setFocus(initialFocus)
    if (languageFromFocus(initialFocus)) setLanguage(languageFromFocus(initialFocus)!)
    else if (initialLanguage) setLanguage(initialLanguage)
  }, [initialMode, initialFocus, initialLanguage])

  const access = useLanguageAccess()
  const accessEndpointMissing = isAxiosError(access.error) && access.error.response?.status === 404
  const effectiveLanguage = access.data?.languages.includes(language) ? language : access.data?.preferred_language ?? ''
  useEffect(() => { if (access.data && effectiveLanguage !== language) setLanguage(effectiveLanguage) }, [access.data, effectiveLanguage, language])
  const go = (next: StudyMode, nextFocus?: string) => {
    setMode(next)
    setFocus(nextFocus)
    if (nextFocus) { setReferenceSubject(undefined); onNavigate?.(next, nextFocus) }
    else if (referenceSubject) onNavigate?.(next, undefined, referenceSubject)
    else onNavigate?.(next, nextFocus)
  }
  const comparisonAvailable = ['javascript', 'typescript'].includes(effectiveLanguage)
    && ['javascript', 'typescript'].every(l => access.data?.languages.includes(l))
  useEffect(() => { if (access.data && mode === 'compare' && !comparisonAvailable) setMode('explain') }, [access.data, mode, comparisonAvailable])
  const current = STUDY_MODES.find((m) => m.id === mode)!

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Study Room</p>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">
            Study Room
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
            A coach that knows where you are in your path and ends every session with something concrete. You get 5 free messages a day; after that each message costs 1 peppercorn. Quizzes and What next are always free.
          </p>
        </div>
        <div className="controls">
          {access.data && !student && <ProviderSelector value={provider} onChange={setProvider} />}
          {access.data && <LanguageSelector value={effectiveLanguage} onChange={(value) => { setLanguage(value); setFocus(undefined); setReferenceSubject(undefined) }} />}
        </div>
      </div>
      {student && <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">AI selection is automatic for each question. Choose your learning language and a mode.</p>}
      <nav className="lang-tabs mb-2" aria-label="Study Room modes">
        {STUDY_MODES.filter(m => m.id !== 'compare' || comparisonAvailable).map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id}
          className={`lang-tab ${mode === m.id ? 'is-active' : ''}`} onClick={() => go(m.id, focus)}>{m.label}</button>)}
      </nav>
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">{current.blurb}</p>
      {access.isLoading && <section className="rounded-xl border border-[var(--line)] p-5" role="status">Checking your learning access…</section>}
      {access.isError && <section className="rounded-xl border border-amber-300/40 bg-amber-950/20 p-5" role="alert">
        <h2 className="m-0 text-lg font-semibold">We couldn’t check your learning access</h2>
        <p className="my-2">{accessEndpointMissing ? 'The learning-access service is unavailable on this server.' : getApiErrorMessage(access.error)}</p>
        <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">We couldn’t confirm the languages available to your account, so the tutor is paused. Please try again shortly. If this continues, contact support.</p>
        <button type="button" className="primary-btn" onClick={() => void access.refetch()} disabled={access.isFetching}>
          {access.isFetching ? 'Checking…' : 'Try again'}
        </button>
      </section>}
      {!access.isError && access.data && !effectiveLanguage && <section className="rounded-xl border border-[var(--line)] p-5">
        <h2 className="m-0 text-lg font-semibold">No learning language is active yet</h2>
        <p className="my-2">For students, an active subscription must include a language. Instructors need a teaching assignment or uploaded learning material.</p>
        <Link className="font-semibold underline" to="/profile">Review your account and subscription</Link>
      </section>}
      {!access.isError && effectiveLanguage && (mode === 'chat'
        ? <OpenChat key={`${effectiveLanguage}:${referenceSubject ?? ''}`} initialSubject={referenceSubject} onSubjectChange={(value) => { setReferenceSubject(value || undefined); setFocus(undefined); onNavigate?.('chat', undefined, value || undefined) }} language={effectiveLanguage} languages={access.data!.languages}
            provider={student ? 'auto' : provider} userId={user?.id} />
        : <StudyWorkspace key={effectiveLanguage} language={effectiveLanguage} languages={access.data!.languages}
            mode={mode} focus={focus} subject={referenceSubject} provider={student ? 'auto' : provider}
            onFocus={(nodeId) => { setFocus(nodeId); setReferenceSubject(undefined); onNavigate?.(mode, nodeId) }} onOpen={go} />)}
    </main>
  )
}
