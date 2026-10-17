// Manages chat state: message history, thread ID, errors, and API calls.
import { useCallback, useState } from 'react'
import { getApiErrorMessage, sendChatMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Message, Provider } from '../types'

export function useChat(
  provider: Provider,
  language: string,
  track: string = 'dsa',
  focusId?: string,
  subject?: string,
  retrievalMode: 'standard' | 'agentic' = 'standard',
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [threadId, setThreadId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setBalance } = useAuth()

  const sendMessage = useCallback(
    async (text: string) => {
      // Optimistically add the user message immediately
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setError(null)

      try {
        const { answer, thread_id, peppercorns_remaining, sources, retrieval } = await sendChatMessage({
          message: text,
          threadId,
          provider,
          language,
          track,
          focusId,
          subject,
          retrievalMode,
        })
        setThreadId(thread_id) // persist for conversation continuity
        setBalance(peppercorns_remaining) // keep the header badge in sync
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: answer,
          sources,
          retrieval,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, botMsg])
      } catch (err) {
        // Surface the failure instead of swallowing it; roll back the
        // optimistic user message so the transcript matches the server.
        setError(getApiErrorMessage(err))
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } finally {
        setLoading(false)
      }
    },
    [threadId, provider, language, track, focusId, subject, retrievalMode, setBalance],
  )

  return { messages, loading, error, sendMessage }
}
