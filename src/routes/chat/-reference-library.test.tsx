import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pilot = vi.hoisted(() => ({ enabled: false, failed: false }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'chat-capabilities' ? { data: { agentic_retrieval: pilot.enabled }, isError: pilot.failed } : ({ data: [
    { id: 'spring-mvc', language: 'java', retrievable_records: 3 },
    { id: 'python-flask', language: 'python', retrievable_records: 20 },
  ], isError: false }),
}))
vi.mock('../../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: { preferred_language: 'java' } }) }))
vi.mock('../../components/ChatWindow', () => ({ ChatWindow: (props: unknown) => <div data-testid="chat-props">{JSON.stringify(props)}</div> }))
vi.mock('../../components/ProviderSelector', () => ({ ProviderSelector: () => null }))
vi.mock('../../components/LanguageSelector', () => ({ LanguageSelector: () => <span>Primary language selector</span> }))
import { ChatPage } from './index'

beforeEach(() => { pilot.enabled = false; pilot.failed = false })
afterEach(cleanup)
describe('Reference library learning', () => {
  it('keeps ordinary retrieval as the default and hides an unavailable experiment', () => {
    render(<ChatPage />)
    expect(screen.queryByLabelText(/Try experimental retrieval/)).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('does not use cached capability data after a capability lookup failure', () => {
    pilot.enabled = true
    pilot.failed = true
    render(<ChatPage />)
    expect(screen.queryByLabelText(/Try experimental retrieval/)).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('lets an authorized pilot user opt in and switch back', () => {
    pilot.enabled = true
    render(<ChatPage />)
    const toggle = screen.getByLabelText(/Try experimental retrieval/)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
    fireEvent.click(toggle)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('agentic')
    fireEvent.click(toggle)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('sends the selected framework and its language to a new chat scope', () => {
    render(<ChatPage />)
    fireEvent.change(screen.getByLabelText('Reference library'), { target: { value: 'python-flask' } })
    const props = JSON.parse(screen.getByTestId('chat-props').textContent!)
    expect(props).toMatchObject({ language: 'python', subject: 'python-flask', track: 'language' })
    expect(screen.queryByText('Primary language selector')).toBeNull()
    expect(screen.getByText(/not a verified workout/)).toBeTruthy()
  })
  it('returns to the primary DSA scope without a reference subject', () => {
    render(<ChatPage />)
    fireEvent.change(screen.getByLabelText('Reference library'), { target: { value: 'spring-mvc' } })
    fireEvent.change(screen.getByLabelText('Reference library'), { target: { value: '' } })
    const props = JSON.parse(screen.getByTestId('chat-props').textContent!)
    expect(props).toMatchObject({ language: 'java', track: 'dsa' })
    expect(props.subject).toBeUndefined()
    expect(screen.getByText('Primary language selector')).toBeTruthy()
  })
})
