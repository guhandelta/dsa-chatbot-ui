// Learn mode: conversational RAG tutoring. Auth-gated.
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { ChatWindow } from '../../components/ChatWindow'
import { LanguageSelector } from '../../components/LanguageSelector'
import { ProviderSelector } from '../../components/ProviderSelector'
import { hasToken } from '../../lib/auth'
import type { Provider } from '../../types'

export const Route = createFileRoute('/chat/')({
  beforeLoad: () => {
    if (!hasToken()) {
      throw redirect({ to: '/login' })
    }
  },
  component: ChatPage,
})

function ChatPage() {
  const [provider, setProvider] = useState<Provider>('openai')
  const [language, setLanguage] = useState('python')

  return (
    <main className="page-wrap px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">Learn mode</p>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)]">
            Chat with your DSA tutor
          </h1>
        </div>
        <div className="controls">
          <ProviderSelector value={provider} onChange={setProvider} />
          <LanguageSelector value={language} onChange={setLanguage} />
        </div>
      </div>
      <ChatWindow provider={provider} language={language} chatCost={1} />
    </main>
  )
}
