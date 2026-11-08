import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchTrackItems: vi.fn(), fetchContentItem: vi.fn(), fetchCurriculumProgress: vi.fn(), navigate: vi.fn(), search: { mode: 'browse' } }))
vi.mock('../../lib/api', () => ({ ...mocks, getApiErrorMessage: (e: Error) => e.message }))
vi.mock('../../lib/auth', () => ({ hasToken: () => true }))
vi.mock('../../lib/languageAccess', () => ({ LANGUAGE_LABELS: { python: 'Python' }, useLanguageAccess: () => ({ data: { role: 'admin', preferred_language: 'python' } }) }))
vi.mock('../../lib/learningSupport', () => ({ useSupportTask: () => {} }))
vi.mock('../../components/ChatWindow', () => ({ ChatWindow: () => <p>Mentor chat</p> }))
vi.mock('../../components/ProviderSelector', () => ({ ProviderSelector: () => <p>Provider selector</p> }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (value: object) => ({ ...value, useParams: () => ({ track: 'design-patterns' }), useSearch: () => mocks.search }),
  redirect: (value: unknown) => value,
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}))
import { Route } from './$track'

const TrackPage = (Route as unknown as { component: () => React.ReactElement }).component
beforeEach(() => {
  vi.clearAllMocks()
  mocks.search = { mode: 'browse' }
  mocks.fetchTrackItems.mockResolvedValue([
    { id: 'iterator', title: 'Iterator', track: 'design-patterns', order: 1, has_tests: false },
  ])
})
afterEach(cleanup)

it('shows Design Patterns as reference lessons with only the Lessons tab', async () => {
  mocks.search = { mode: 'practice' }
  render(<TrackPage />)
  expect(await screen.findByText(/Iterator/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Design Patterns' })).toBeTruthy()
  expect(screen.getByText(/These are reference lessons; graded practice and mastery tracking are in development/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Lessons' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Practice' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Ask mentor' })).toBeNull()
  expect(screen.queryByText('Difficulty')).toBeNull()
  expect(screen.queryByText('Provider selector')).toBeNull()
  expect(screen.queryByText(/planned for a later release/)).toBeNull()
  expect(mocks.fetchTrackItems).toHaveBeenCalledWith('design-patterns', { language: 'python', difficulty: undefined })
})
