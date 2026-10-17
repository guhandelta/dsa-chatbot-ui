// Main chat interface: renders message history, errors, and the input box.
import { useEffect, useRef, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { MessageBubble } from './MessageBubble'
import type { Provider } from '../types'

interface Props {
  provider: Provider
  language: string
  track?: string
  focusId?: string
  subject?: string
  chatCost?: number
  retrievalMode?: 'standard' | 'agentic'
}

export function ChatWindow({ provider, language, track = 'dsa', focusId, subject, chatCost = 1, retrievalMode = 'standard' }: Props) {
  const { messages, loading, error, sendMessage } = useChat(provider, language, track, focusId, subject, retrievalMode)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view. Without this the transcript silently
  // grows below the fold and the user has to scroll after every exchange.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div className="chat-container island-shell">
      {/* Message history — scrollable */}
      <div className="messages">
        {messages.length === 0 && (
          <p className="m-0 py-10 text-center text-sm text-[var(--sea-ink-soft)]">
            Ask about a problem to get started — e.g. “Give me a hint for Two Sum”
            or “Explain when to use binary search”.
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && <div className="typing-indicator">Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* User input */}
      <div className="input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Ask about a DSA problem, e.g. 'Explain Two Sum'"
          disabled={loading}
        />
        <button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
      <p className="cost-note">Each message costs {chatCost} peppercorn{chatCost === 1 ? '' : 's'}.</p>
    </div>
  )
}
