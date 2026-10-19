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
  { id: 'explain', label: 'Explain', blurb: 'Ask about the concept you are learning now.' },
  { id: 'quiz', label: 'Quiz me', blurb: 'A short mixed-format quiz, graded on the server.' },
  { id: 'debug', label: 'Debug with me', blurb: 'Find the cause of an error yourself, one question at a time.' },
  { id: 'compare', label: 'Compare languages', blurb: 'See the same idea side by side in two languages.' },
  { id: 'next', label: 'What next?', blurb: 'One recommended step, from your progress and weak spots.' },
  { id: 'chat', label: 'Open chat', blurb: 'The free-form tutor and reference collections.' },
]

export function parseSearch(search: Record<string, unknown>): { mode?: StudyMode; focus?: string } {
  return {
    ...(STUDY_MODES.some((m) => m.id === search.mode) ? { mode: search.mode as StudyMode } : {}),
    ...(typeof search.focus === 'string' && search.focus ? { focus: search.focus } : {}),
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
  return <ChatPage initialMode={search.mode ?? 'explain'} initialFocus={search.focus}
    onNavigate={(mode, focus) => void navigate({ to: '/chat', search: { mode, ...(focus ? { focus } : {}) } })} />
}

interface PageProps {
  initialMode?: StudyMode
  initialFocus?: string
  onNavigate?: (mode: StudyMode, focus?: string) => void
}

export function ChatPage({ initialMode = 'explain', initialFocus, onNavigate }: PageProps) {
  const [provider, setProvider] = useState<Provider>('gemini')
  const { user } = useAuth()
  const student = user?.role === 'student'
  // A path node id ("python:stage-07") carries its language, so a deep link
  // opens in that language rather than the account's preferred one.
  const [language, setLanguage] = useState(initialFocus?.split(':')[1] ? initialFocus.split(':')[0] : user?.preferred_language ?? '')
  const [mode, setMode] = useState<StudyMode>(initialMode)
  const [focus, setFocus] = useState<string | undefined>(initialFocus)
  // Back/forward navigation updates route props without remounting the page.
  useEffect(() => {
    setMode(initialMode)
    setFocus(initialFocus)
    if (initialFocus?.split(':')[1]) setLanguage(initialFocus.split(':')[0])
  }, [initialMode, initialFocus])

  const access = useLanguageAccess()
  const accessEndpointMissing = isAxiosError(access.error) && access.error.response?.status === 404
  const effectiveLanguage = access.data?.languages.includes(language) ? language : access.data?.preferred_language ?? ''
  useEffect(() => { if (access.data && effectiveLanguage !== language) setLanguage(effectiveLanguage) }, [access.data, effectiveLanguage, language])
  const go = (next: StudyMode, nextFocus?: string) => {
    setMode(next)
    setFocus(nextFocus)
    onNavigate?.(next, nextFocus)
  }
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
          {access.data && <LanguageSelector value={effectiveLanguage} onChange={(value) => { setLanguage(value); setFocus(undefined) }} />}
        </div>
      </div>
      {student && <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">AI selection is automatic for each question. Choose your learning language and a mode.</p>}
      <nav className="lang-tabs mb-2" aria-label="Study Room modes">
        {STUDY_MODES.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id}
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
        ? <OpenChat key={effectiveLanguage} language={effectiveLanguage} languages={access.data!.languages}
            provider={student ? 'auto' : provider} userId={user?.id} />
        : <StudyWorkspace key={effectiveLanguage} language={effectiveLanguage} languages={access.data!.languages}
            mode={mode} focus={focus} provider={student ? 'auto' : provider}
            onFocus={(nodeId) => { setFocus(nodeId); onNavigate?.(mode, nodeId) }} onOpen={go} />)}
    </main>
  )
}
