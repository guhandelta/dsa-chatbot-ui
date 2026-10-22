// /practice opens Study Room links in the path's language, including Python stage exercises.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ search: {} as Record<string, string>, preferred: 'javascript', languages: ['javascript', 'python', 'java'] }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ ...options, useSearch: () => state.search }),
  redirect: (value: unknown) => value,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: { id: 'u', preferred_language: state.preferred }, setBalance: vi.fn() }) }))
vi.mock('../lib/languageAccess', () => ({
  LANGUAGE_LABELS: { python: 'Python', javascript: 'JavaScript' },
  useLanguageAccess: () => ({ data: { languages: state.languages }, isError: false }),
}))
vi.mock('../components/ProblemPicker', () => ({ ProblemPicker: ({ value }: { value: string }) => <span>picker:{value}</span> }))
vi.mock('../components/LanguageSelector', () => ({ LanguageSelector: ({ value }: { value: string }) => <span>language:{value}</span> }))

import { Route, PracticeWorkspace } from './practice'

const Page = (Route as unknown as { component: () => React.ReactElement }).component
const validate = (Route as unknown as { validateSearch: (s: Record<string, unknown>) => unknown }).validateSearch

// Keep the workspace out of these tests; only the page's language choice matters here.
vi.mock('@monaco-editor/react', () => ({ default: ({ value }: { value: string }) => <pre data-testid="editor">{value}</pre> }))
vi.mock('../lib/api', () => ({
  fetchTrackItems: vi.fn().mockResolvedValue([]), fetchSolutionAccess: vi.fn().mockResolvedValue(false),
  revealSolution: vi.fn(), practiceAction: vi.fn(), startPractice: vi.fn().mockRejectedValue(new Error('offline')),
  fetchPractice: vi.fn(), getApiErrorMessage: () => 'offline',
}))
vi.mock('../components/ProblemStatement', () => ({ ProblemStatement: () => null }))
vi.mock('../components/MentorPanel', () => ({ MentorPanel: () => null }))

beforeEach(() => { state.search = {}; state.preferred = 'javascript'; state.languages = ['javascript', 'python', 'java', 'typescript', 'ruby', 'go', 'csharp']; sessionStorage.clear() })
afterEach(cleanup)

it('recognises Python stage exercises as language exercises', () => {
  state.search = { problem: 'python-path-03-loops' }
  render(<Page />)
  expect(screen.getByText(/Language exercise · Python/)).toBeTruthy()
  expect(screen.queryByText(/picker:/)).toBeNull()
})

it('shows the raw language id when a stage exercise has no label', () => {
  state.search = { problem: 'java-path-01-values' }
  render(<Page />)
  expect(screen.getByText(/Language exercise · java$/)).toBeTruthy()
})

it('opens a problem in the language the Study Room asked for', () => {
  state.search = { problem: 'two-sum', language: 'python' }
  render(<Page />)
  expect(screen.getByText('language:python')).toBeTruthy()
  expect(screen.getByText('picker:two-sum')).toBeTruthy()
})

it('falls back to the preferred language without a request', () => {
  state.preferred = 'java'
  state.search = { problem: 'two-sum' }
  render(<Page />)
  expect(screen.getByText('language:java')).toBeTruthy()
})

it('validates search params', () => {
  expect(validate({ problem: 'two-sum', language: 'python' })).toEqual({ problem: 'two-sum', language: 'python' })
  expect(validate({ problem: 3, language: [] })).toEqual({ problem: undefined, language: undefined })
})


it('keeps the preferred Python language when multiple subscriptions exist', () => {
  state.preferred = 'python'
  render(<Page />)
  expect(screen.getByText('language:python')).toBeTruthy()
})

it('blocks a direct link to an exercise outside the subscription', () => {
  state.languages = ['java']
  state.search = { problem: 'python-path-01-values', language: 'python' }
  render(<Page />)
  expect(screen.getByText('This exercise is outside your current language access.')).toBeTruthy()
  expect(screen.queryByTestId('editor')).toBeNull()
})

it.each(['python', 'c', 'cpp', 'rust', 'java', 'javascript'])('uses a %s starter rather than a JavaScript fallback', async language => {
  render(<PracticeWorkspace problemId="two-sum" language={language} />)
  const label = { python: 'Python', javascript: 'JavaScript' }[language as 'python' | 'javascript'] ?? language
  expect(await screen.findByText(`Define the problem function in ${label}.`, { exact: false })).toBeTruthy()
  if (language !== 'javascript') expect(screen.getByTestId('editor').textContent).not.toContain('JavaScript')
})

it.each(['typescript', 'ruby', 'go', 'csharp'])('lists %s as a practice language', language => {
  state.preferred = language
  render(<Page />)
  expect(screen.getByText(`language:${language}`)).toBeTruthy()
})
