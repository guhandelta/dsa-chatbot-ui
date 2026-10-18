import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../lib/api', () => ({
  fetchLearningProfile: vi.fn().mockResolvedValue({ total_attempts:0, solved:0, avg_hint_tier:0, languages:[], summary:'No practice yet', recurring_errors:[], weak_algorithms:[], strong_algorithms:[] }),
  fetchSubscriptions: vi.fn().mockResolvedValue([]),
  exportLearningProfile: vi.fn(), deleteLearningProfile: vi.fn(),
  getApiErrorMessage: () => 'Export unavailable',
}))
vi.mock('../lib/auth', () => ({ hasToken: () => true }))
import { exportLearningProfile, fetchLearningProfile, fetchSubscriptions } from '../lib/api'
import { ProfilePage } from './profile'
const createUrl = vi.fn(() => 'blob:learning-profile')
const revokeUrl = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchLearningProfile).mockResolvedValue({ total_attempts:0, solved:0, avg_hint_tier:0, languages:[], summary:'No practice yet', recurring_errors:[], weak_algorithms:[], strong_algorithms:[] })
  vi.mocked(fetchSubscriptions).mockResolvedValue([])
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
