// The Study Room page: mode tabs, focus tied to the path, and URL search state.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  languages: ['python', 'java'] as string[], role: 'student', signedIn: true, search: {} as Record<string, string>, navigate: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => state.search }),
  redirect: (value: unknown) => value,
  useNavigate: () => state.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('../../lib/languageAccess', () => ({
  useLanguageAccess: () => ({ data: { languages: state.languages, preferred_language: state.languages[0] }, isError: false }),
}))
vi.mock('../../lib/auth', () => ({ hasToken: () => state.role !== 'anonymous', useAuth: () => ({ user: state.signedIn ? { id: 'u1', role: state.role, preferred_language: 'python' } : null }) }))
vi.mock('../../components/study/StudyWorkspace', () => ({
  StudyWorkspace: (props: { mode: string; focus?: string; language: string; provider: string; onFocus: (id: string) => void; onOpen: (mode: string, focus: string) => void }) => <div data-testid="workspace">
    {JSON.stringify({ mode: props.mode, focus: props.focus, language: props.language, provider: props.provider })}
    <button type="button" onClick={() => props.onFocus('python:stage-03')}>focus stage 3</button>
    <button type="button" onClick={() => props.onOpen('quiz', 'python:stage-02')}>open review</button>
  </div>,
}))
vi.mock('../../components/study/OpenChat', () => ({ OpenChat: (props: unknown) => <div data-testid="open-chat">{JSON.stringify(props)}</div> }))
vi.mock('../../components/ProviderSelector', () => ({ ProviderSelector: () => <span>Model selector</span> }))
vi.mock('../../components/LanguageSelector', () => ({
  LanguageSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <label>Language
    <select value={value} onChange={(e) => onChange(e.target.value)}>{state.languages.map((l) => <option key={l}>{l}</option>)}</select></label>,
}))

import { ChatPage, Route, STUDY_MODES, parseSearch } from './index'

const workspace = () => JSON.parse(screen.getByTestId('workspace').textContent!.replace(/focus stage 3open review$/, ''))

beforeEach(() => { state.languages = ['python', 'java']; state.role = 'student'; state.signedIn = true; state.search = {}; state.navigate.mockClear() })
afterEach(cleanup)

describe('Study Room page', () => {
  it('opens on Explain with five modes plus the open tutor', () => {
    render(<ChatPage />)
    expect(screen.getByRole('heading', { name: 'Study Room' })).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual(
      ['Quiz me', 'Debug with me', 'Compare languages', 'What next?', 'Open chat'])
    expect(workspace()).toEqual({ mode: 'explain', language: 'python', provider: 'auto' })
    expect(screen.getByText(/5 free messages a day/)).toBeTruthy()
    expect(screen.queryByText('Model selector')).toBeNull()
  })

  it('switches modes, keeps the focus, and reports navigation', () => {
    const onNavigate = vi.fn()
    render(<ChatPage initialMode="debug" initialFocus="python:stage-04" onNavigate={onNavigate} />)
    expect(workspace()).toMatchObject({ mode: 'debug', focus: 'python:stage-04' })
    fireEvent.click(screen.getByText('Quiz me'))
    expect(workspace()).toMatchObject({ mode: 'quiz', focus: 'python:stage-04' })
    expect(onNavigate).toHaveBeenLastCalledWith('quiz', 'python:stage-04')
    expect(screen.getByText(STUDY_MODES[1].blurb)).toBeTruthy()
    fireEvent.click(screen.getByText('focus stage 3'))
    expect(workspace().focus).toBe('python:stage-03')
    expect(onNavigate).toHaveBeenLastCalledWith('quiz', 'python:stage-03')
    fireEvent.click(screen.getByText('open review'))
    expect(workspace()).toMatchObject({ mode: 'quiz', focus: 'python:stage-02' })
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'java' } })
    expect(workspace()).toEqual({ mode: 'quiz', language: 'java', provider: 'auto' })
    fireEvent.click(screen.getByText('Open chat'))
    expect(JSON.parse(screen.getByTestId('open-chat').textContent!)).toMatchObject({ language: 'java', languages: ['python', 'java'], provider: 'auto', userId: 'u1' })
  })

  it('opens a deep-linked path node in its own language', () => {
    render(<ChatPage initialMode="quiz" initialFocus="java:stage-07" />)
    expect(workspace()).toMatchObject({ mode: 'quiz', focus: 'java:stage-07', language: 'java' })
    cleanup()
    render(<ChatPage initialMode="explain" initialFocus="two-sum" />)
    expect(workspace()).toMatchObject({ focus: 'two-sum', language: 'python' })
  })

  it('follows browser-history changes without remounting the route', () => {
    state.search = { mode: 'explain', focus: 'python:stage-01' }
    const Component = (Route as unknown as { component: () => React.ReactElement }).component
    const { rerender } = render(<Component />)
    state.search = { mode: 'quiz', focus: 'java:stage-07' }
    rerender(<Component />)
    expect(workspace()).toMatchObject({ mode: 'quiz', focus: 'java:stage-07', language: 'java' })
    state.search = { mode: 'explain', focus: 'python:stage-01' }
    rerender(<Component />)
    expect(workspace()).toMatchObject({ mode: 'explain', focus: 'python:stage-01', language: 'python' })
    state.search = {}
    rerender(<Component />)
    expect(workspace()).toEqual({ mode: 'explain', language: 'python', provider: 'auto' })
  })

  it('falls back to the account language list while the user is still loading', () => {
    state.signedIn = false
    render(<ChatPage />)
    expect(workspace().language).toBe('python')
  })

  it('lets staff choose a model', () => {
    state.role = 'instructor'
    render(<ChatPage />)
    expect(screen.getByText('Model selector')).toBeTruthy()
    expect(workspace().provider).toBe('gemini')
  })

  it('parses search params defensively', () => {
    expect(parseSearch({ mode: 'quiz', focus: 'python:stage-01' })).toEqual({ mode: 'quiz', focus: 'python:stage-01' })
    expect(parseSearch({ mode: 'hack', focus: '' })).toEqual({})
    expect(parseSearch({ focus: 3 })).toEqual({})
  })

  it('reads mode and focus from the URL and writes changes back', () => {
    state.search = { mode: 'compare', focus: 'python:stage-07' }
    const Component = (Route as unknown as { component: () => React.ReactElement }).component
    render(<Component />)
    expect(workspace()).toMatchObject({ mode: 'compare', focus: 'python:stage-07' })
    fireEvent.click(screen.getByText('What next?'))
    expect(state.navigate).toHaveBeenLastCalledWith({ to: '/chat', search: { mode: 'next', focus: 'python:stage-07' } })
    cleanup()
    state.search = {}
    render(<Component />)
    expect(workspace().mode).toBe('explain')
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'java' } })
    fireEvent.click(screen.getByText('Open chat'))
    expect(state.navigate).toHaveBeenLastCalledWith({ to: '/chat', search: { mode: 'chat' } })
  })

  it('redirects signed-out visitors to login', () => {
    state.role = 'anonymous'
    const beforeLoad = (Route as unknown as { beforeLoad: () => void }).beforeLoad
    expect(beforeLoad).toThrow()
    state.role = 'student'
    expect(beforeLoad()).toBeUndefined()
  })
})
