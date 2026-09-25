import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'

// Mock the API module so no real network call happens
vi.mock('../lib/api', () => ({
  sendChatMessage: vi.fn(),
  getApiErrorMessage: () => 'mocked error',
}))

import { sendChatMessage } from '../lib/api'
import { useChat } from './useChat'
import { AuthProvider } from '../lib/auth'

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AuthProvider, null, children)

describe('useChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appends user and assistant messages on success', async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({
      answer: 'hello back',
      thread_id: 't1',
      peppercorns_remaining: 49,
    })
    const { result } = renderHook(() => useChat('openai', 'python'), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hi')
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[1].content).toBe('hello back')
    expect(result.current.error).toBeNull()
  })

  it('rolls back the optimistic user message on failure', async () => {
    vi.mocked(sendChatMessage).mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useChat('openai', 'python'), { wrapper })

    await act(async () => {
      await result.current.sendMessage('hi')
    })

    await waitFor(() => expect(result.current.error).toBe('mocked error'))
    expect(result.current.messages).toHaveLength(0) // rolled back
  })
})
