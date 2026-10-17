// Learn mode: conversational RAG tutoring. Auth-gated.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChatCapabilities, fetchReferenceSubjects } from '../../lib/api'
import { ChatWindow } from '../../components/ChatWindow'
import { LanguageSelector } from '../../components/LanguageSelector'
import { ProviderSelector } from '../../components/ProviderSelector'
import { hasToken, useAuth } from '../../lib/auth'
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
  const [language, setLanguage] = useState(user?.preferred_language === 'java' ? 'java' : 'javascript')

  const [subjectId, setSubjectId] = useState('')
  const [agentic, setAgentic] = useState(false)
  const capabilities = useQuery({ queryKey: ['chat-capabilities', user?.id], queryFn: fetchChatCapabilities })
  const pilotAvailable = capabilities.data?.agentic_retrieval && !capabilities.isError
  const retrievalMode = pilotAvailable && agentic ? 'agentic' : 'standard'
  const library = useQuery({ queryKey: ['reference-subjects'], queryFn: fetchReferenceSubjects })
  const subject = library.data?.find((item) => item.id === subjectId)

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Learn mode</p>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">
            Learn with your AI tutor
          </h1>
        </div>
        <div className="controls">
          <ProviderSelector value={provider} onChange={setProvider} />
          {!subject && <LanguageSelector value={language} onChange={setLanguage} />}
        </div>
      </div>
      <section className="mb-4 rounded-xl border border-[var(--line)] p-4">
        <label className="block text-sm font-semibold" htmlFor="reference-subject">Reference library</label>
        <select id="reference-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 rounded-lg border p-2">
          <option value="">Current DSA tutor</option>
          {library.data?.filter((item) => item.retrievable_records > 0).map((item) => (
            <option key={item.id} value={item.id}>{item.id.replaceAll('-', ' ')} ({item.retrievable_records} references)</option>
          ))}
        </select>
        {library.isError && <p role="alert">The reference library could not be loaded. Please refresh to try again.</p>}
        {subject && <p className="mt-2 text-sm">Reference learning in {subject.language}. This material is not a verified workout; framework and hardware examples need their own execution checks.</p>}
      </section>
      {pilotAvailable && (
        <label className="mb-4 block text-sm">
          <input type="checkbox" checked={agentic} onChange={(e) => setAgentic(e.target.checked)} />{' '}
          Try experimental retrieval
          <span className="ml-2">May take longer; references and answers still need review.</span>
        </label>
      )}
      <ChatWindow retrievalMode={retrievalMode} key={`${subject?.id ?? `dsa:${language}`}:${retrievalMode}`} provider={provider} language={subject?.language ?? language} track={subject ? 'language' : 'dsa'} subject={subject?.id} chatCost={1} />
    </main>
  )
}
