import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pilot = vi.hoisted(() => ({ enabled: false, failed: false, libraryFailed: false, libraryLoading: false, role: 'admin', languages: ['java', 'python'] as string[] }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  Link: ({ children }: { children: import('react').ReactNode }) => <a>{children}</a>,
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'reference-subjects' && pilot.libraryLoading ? { data: undefined, isError: false } : queryKey[0] === 'language-access' ? { data: { languages: pilot.languages, preferred_language: pilot.languages[0] }, isError: false } : queryKey[0] === 'chat-capabilities' ? { data: { agentic_retrieval: pilot.enabled }, isError: pilot.failed } : ({ data: [
    { id: 'spring-mvc', language: 'java', retrievable_records: 3 },
    { id: 'python-flask', language: 'python', retrievable_records: 20 },
  ], isError: pilot.libraryFailed }),
}))
vi.mock('../../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: { role: pilot.role, preferred_language: 'java' } }) }))
vi.mock('../../components/ChatWindow', () => ({ ChatWindow: (props: unknown) => <div data-testid="chat-props">{JSON.stringify(props)}</div> }))
vi.mock('../../components/ProviderSelector', () => ({ ProviderSelector: () => <span>Model selector</span> }))
vi.mock('../../components/LanguageSelector', () => ({ LanguageSelector: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <label>Language<select value={value} onChange={(event) => onChange(event.target.value)}>{pilot.languages.map(language => <option key={language}>{language}</option>)}</select></label> }))
import { ChatPage } from './index'

beforeEach(() => { pilot.enabled = false; pilot.failed = false; pilot.libraryFailed = false; pilot.libraryLoading = false; pilot.role = 'admin'; pilot.languages = ['java', 'python'] })
afterEach(cleanup)
describe('Reference library learning', () => {
  it('keeps ordinary retrieval as the default and hides an unavailable experiment', () => {
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByLabelText(/Try experimental retrieval/)).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('does not use cached capability data after a capability lookup failure', () => {
    pilot.enabled = true
    pilot.failed = true
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByLabelText(/Try experimental retrieval/)).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('lets an authorized pilot user opt in and switch back', () => {
    pilot.enabled = true
    render(<ChatPage initialMode="chat" />)
    const toggle = screen.getByLabelText(/Try experimental retrieval/)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
    fireEvent.click(toggle)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('agentic')
    fireEvent.click(toggle)
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).retrievalMode).toBe('standard')
  })
  it('sends the selected framework and its language to a new chat scope', () => {
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByRole('option', { name: /python flask/ })).toBeNull()
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'python' } })
    fireEvent.change(screen.getByLabelText('Learning material (optional)'), { target: { value: 'python-flask' } })
    const props = JSON.parse(screen.getByTestId('chat-props').textContent!)
    expect(props).toMatchObject({ language: 'python', subject: 'python-flask', track: 'language' })
    expect(screen.getByLabelText('Language')).toBeTruthy()
    expect(screen.getByText(/not a verified workout/)).toBeTruthy()
  })
  it('returns to the primary DSA scope without a reference subject', () => {
    render(<ChatPage initialMode="chat" />)
    fireEvent.change(screen.getByLabelText('Learning material (optional)'), { target: { value: 'spring-mvc' } })
    fireEvent.change(screen.getByLabelText('Learning material (optional)'), { target: { value: '' } })
    const props = JSON.parse(screen.getByTestId('chat-props').textContent!)
    expect(props).toMatchObject({ language: 'java', track: 'dsa' })
    expect(props.subject).toBeUndefined()
    expect(screen.getByLabelText('Language')).toBeTruthy()
  })
  it('resets the reference scope when the language changes', () => {
    render(<ChatPage initialMode="chat" />)
    fireEvent.change(screen.getByLabelText('Learning material (optional)'), { target: { value: 'spring-mvc' } })
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'python' } })
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!)).toMatchObject({ language: 'python', track: 'language' })
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).subject).toBeUndefined()
  })
  it('uses automatic models for students and keeps staff selection available', () => {
    pilot.role = 'student'
    const { unmount } = render(<ChatPage initialMode="chat" />)
    expect(screen.queryByText('Model selector')).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).provider).toBe('auto')
    unmount()
    pilot.role = 'instructor'
    render(<ChatPage initialMode="chat" />)
    expect(screen.getByText('Model selector')).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).provider).toBe('gemini')
  })
  it('shows the general tutor while learning material is loading', () => {
    pilot.libraryLoading = true
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByLabelText('Learning material (optional)')).toBeNull()
    expect(screen.getByTestId('chat-props')).toBeTruthy()
  })

  it('keeps the general tutor when learning material cannot be loaded', () => {
    pilot.libraryFailed = true
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByLabelText('Learning material (optional)')).toBeNull()
    expect(screen.getByText(/The general tutor is still available/)).toBeTruthy()
    expect(screen.getByTestId('chat-props')).toBeTruthy()
  })

  it('hides the material selector when no collection exists for the current language', () => {
    pilot.languages = ['javascript']
    render(<ChatPage initialMode="chat" />)
    expect(screen.queryByLabelText('Learning material (optional)')).toBeNull()
    expect(JSON.parse(screen.getByTestId('chat-props').textContent!).language).toBe('javascript')
  })
})

it('does not mount the tutor when no languages are available', () => {
  pilot.languages = []
  render(<ChatPage initialMode="chat" />)
  expect(screen.queryByTestId('chat-props')).toBeNull()
  expect(screen.getByText(/No learning language is active/)).toBeTruthy()
})
