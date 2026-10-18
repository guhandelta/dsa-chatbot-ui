// Learn mode: conversational RAG tutoring. Auth-gated.
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { fetchChatCapabilities, fetchReferenceSubjects, getApiErrorMessage } from '../../lib/api'
import { ChatWindow } from '../../components/ChatWindow'
import { LanguageSelector } from '../../components/LanguageSelector'
import { ProviderSelector } from '../../components/ProviderSelector'
import { hasToken, useAuth } from '../../lib/auth'
import { useLanguageAccess } from '../../lib/languageAccess'
import type { Provider } from '../../types'

export const Route = createFileRoute('/chat/')({
  beforeLoad: () => {
    if (!hasToken()) {
      throw redirect({ to: '/login' })
    }
  },
  component: ChatPage,
})

export function ChatPage() {
  const [provider, setProvider] = useState<Provider>('gemini')
  const { user } = useAuth()
  const student = user?.role === 'student'
  const [language, setLanguage] = useState(user?.preferred_language ?? '')

  const access = useLanguageAccess()
  const accessEndpointMissing = isAxiosError(access.error) && access.error.response?.status === 404
  const effectiveLanguage = access.data?.languages.includes(language) ? language : access.data?.preferred_language ?? ''
  const defaultTrack = ['javascript', 'java'].includes(effectiveLanguage) ? 'dsa' : 'language'
  const [subjectId, setSubjectId] = useState('')
  const [agentic, setAgentic] = useState(false)
  const capabilities = useQuery({ queryKey: ['chat-capabilities', user?.id], queryFn: fetchChatCapabilities })
  const pilotAvailable = capabilities.data?.agentic_retrieval && !capabilities.isError
  const retrievalMode = pilotAvailable && agentic ? 'agentic' : 'standard'
  const library = useQuery({ queryKey: ['reference-subjects', user?.id], queryFn: fetchReferenceSubjects })
  const references = library.isError || access.isError ? [] : (library.data ?? []).filter(
    (item) => item.language === effectiveLanguage && item.retrievable_records > 0 && access.data?.languages.includes(item.language))
  const subject = references.find((item) => item.id === subjectId)
  useEffect(() => { if (access.data && effectiveLanguage !== language) setLanguage(effectiveLanguage) }, [access.data, effectiveLanguage, language])

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Learn mode</p>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">
            Learn with your AI tutor
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
            Get unstuck with a hint, learn a concept, trace an approach, or practice with a short quiz. You stay in control of how much help you get. Each sent message costs 1 peppercorn.
          </p>
        </div>
        <div className="controls">
          {access.data && !student && <ProviderSelector value={provider} onChange={setProvider} />}
          {access.data && <LanguageSelector value={effectiveLanguage} onChange={(value) => { setLanguage(value); setSubjectId('') }} />}
        </div>
      </div>
      {student && <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">AI selection is automatic for each question. Choose your learning language and ask for the help you need.</p>}
      {references.length > 0 && <section className="mb-4 rounded-xl border border-[var(--line)] p-4">
        <label className="block text-sm font-semibold" htmlFor="reference-subject">Learning material (optional)</label>
        <select id="reference-subject" value={subject?.id ?? ''} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 rounded-lg border p-2">
          <option value="">General tutor</option>
          {references.map((item) => (
            <option key={item.id} value={item.id}>{item.id.replaceAll('-', ' ')} ({item.retrievable_records} references)</option>
          ))}
        </select>
        {subject && <p className="mt-2 text-sm">Reference learning in {subject.language}. This material is not a verified workout; framework and hardware examples need their own execution checks.</p>}
        <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">Focus answers on a specific reference collection in your selected language, or use the general tutor. Changing the language or collection starts a new conversation.</p>
      </section>}
      {access.data && library.isError && <p className="mb-4 text-sm" role="status">Optional learning material couldn’t be loaded. The general tutor is still available.</p>}
      {pilotAvailable && (
        <label className="mb-4 block text-sm">
          <input type="checkbox" checked={agentic} onChange={(e) => setAgentic(e.target.checked)} />{' '}
          Try experimental retrieval
          <span className="ml-2">May take longer; references and answers still need review.</span>
        </label>
      )}
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
      {!access.isError && effectiveLanguage && <ChatWindow retrievalMode={retrievalMode} key={`${subject?.id ?? `dsa:${effectiveLanguage}`}:${retrievalMode}`} provider={student ? 'auto' : provider} language={effectiveLanguage} track={subject ? 'language' : defaultTrack} subject={subject?.id} chatCost={1} />}
    </main>
  )
}
