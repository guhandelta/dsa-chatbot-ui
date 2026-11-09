import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../lib/api', () => ({
  fetchLearningProfile: vi.fn().mockResolvedValue({ total_attempts:0, solved:0, avg_hint_tier:0, languages:[], summary:'No practice yet', recurring_errors:[], weak_algorithms:[], strong_algorithms:[] }),
  fetchSubscriptions: vi.fn().mockResolvedValue([]),
  exportLearningProfile: vi.fn(), deleteLearningProfile: vi.fn(),
  getApiErrorMessage: () => 'Export unavailable',
}))
vi.mock('../lib/studyApi', () => ({ fetchProfileOverview: vi.fn().mockResolvedValue({
  languages: [], student_records: { language: {}, dsa: {}, 'design-patterns': {} },
  summary_rule: 'Section measures are separate; problem solves and reference readings are not mastery.',
}) }))
vi.mock('../lib/auth', () => ({ hasToken: () => true }))
import { exportLearningProfile, fetchLearningProfile, fetchSubscriptions } from '../lib/api'
import { fetchProfileOverview } from '../lib/studyApi'
import { ProfilePage } from './profile'
const createUrl = vi.fn(() => 'blob:learning-profile')
const revokeUrl = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchLearningProfile).mockResolvedValue({ total_attempts:0, solved:0, avg_hint_tier:0, languages:[], summary:'No practice yet', recurring_errors:[], weak_algorithms:[], strong_algorithms:[] })
  vi.mocked(fetchSubscriptions).mockResolvedValue([])
  vi.mocked(fetchProfileOverview).mockResolvedValue({
    languages: [], student_records: { language: {}, dsa: {}, 'design-patterns': {} },
    summary_rule: 'Section measures are separate; problem solves and reference readings are not mastery.',
  })
  Object.defineProperty(URL, 'createObjectURL', { configurable:true, value:createUrl })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable:true, value:revokeUrl })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
it('exports through the authenticated API and downloads JSON', async () => {
  vi.mocked(exportLearningProfile).mockResolvedValue({ events:[] })
  const click = vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {})
  render(<ProfilePage />)
  await waitFor(() => expect(screen.getByText('No language subscription yet. Student learning requires an active language subscription; staff access follows their role.')).toBeTruthy())
  vi.useFakeTimers()
  await act(async () => { fireEvent.click(screen.getByRole('button',{ name:'Export' })) })
  expect(exportLearningProfile).toHaveBeenCalledOnce()
  expect(createUrl).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(document.querySelector('a[download]')).toBeNull()
  act(() => { vi.runAllTimers() })
  expect(revokeUrl).toHaveBeenCalledWith('blob:learning-profile')
})
it('shows an export failure without creating a download', async () => {
  vi.mocked(exportLearningProfile).mockRejectedValue(new Error('401'))
  render(<ProfilePage />)
  fireEvent.click(screen.getByRole('button',{ name:'Export' }))
  await waitFor(() => expect(screen.getByText('Export unavailable')).toBeTruthy())
  expect(createUrl).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Export'}).hasAttribute('disabled')).toBe(false)
})

it('shows separate learning measures without claiming Design Patterns mastery', async () => {
  vi.mocked(fetchProfileOverview).mockResolvedValue({
    languages: [{ language: 'javascript', sections: [
      { id: 'learning-path', title: 'Learning Path', metric: 'Current path checkpoints', completed: 2, total: 20, in_progress: 1, status: 'available', detail: 'Existing rule' },
      { id: 'dsa', title: 'DSA Practice', metric: 'Problems solved', completed: 3, total: 23, in_progress: 0, status: 'available', detail: 'Unique solves' },
      { id: 'design-patterns', title: 'Design Patterns', metric: 'Assessment coming soon', completed: null, total: null, in_progress: 0, status: 'coming-soon', detail: 'Reference only' },
    ] }],
    student_records: { language: { goal: 1 }, dsa: { assumption: 2 }, 'design-patterns': {} },
    summary_rule: 'Section measures are separate; problem solves and reference readings are not mastery.',
  })
  render(<ProfilePage />)
  expect(await screen.findByRole('region', { name: 'Learning path progress' })).toBeTruthy()
  expect(screen.getByText('Learning Path: Current path checkpoints')).toBeTruthy()
  expect(screen.getByText('DSA Practice: Problems solved')).toBeTruthy()
  expect(screen.getByText('In development')).toBeTruthy()
  expect(screen.getByText(/Your recorded goals, assumptions, decisions, and path requests:/).textContent).toContain('3')
})
