import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ProgressCharts } from './ProgressCharts'
import { fetchProgressOverview, type ProgressOverview } from '../../lib/studyApi'

vi.mock('../../lib/studyApi', () => ({ fetchProgressOverview: vi.fn() }))
vi.mock('../../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const overview: ProgressOverview = { language: 'python', sections: [
  { id: 'learning-path', title: 'Learning Path', metric: 'Assessed mastery', completed: 2, total: 10, in_progress: 1, status: 'content-incomplete', detail: 'Missing assessments block mastery.' },
  { id: 'debug', title: 'Debug with Me', metric: 'Self-reviewed cases', completed: 3, total: 12, in_progress: 2, status: 'available', detail: 'Self-review is not assessed mastery.' },
  { id: 'design-patterns', title: 'Design Patterns', metric: 'Assessment coming soon', completed: null, total: null, in_progress: 0, status: 'coming-soon', detail: '12 reference lessons available. Graded pathway coming soon.' },
] }

it('uses distinct denominators and never invents a design-pattern mastery percentage', async () => {
  vi.mocked(fetchProgressOverview).mockResolvedValue(overview)
  render(<ProgressCharts language="python" />)
  await screen.findByText('20%')
  expect(screen.getByText('25%')).toBeTruthy()
  expect(screen.getAllByRole('img')).toHaveLength(2)
  expect(screen.getByText('Coming soon')).toBeTruthy()
  expect(screen.getByText('Curriculum still being built')).toBeTruthy()
  expect(screen.getByText('Self-review is not assessed mastery.')).toBeTruthy()
})

it('discards stale progress after switching languages', async () => {
  let resolve!: (value: ProgressOverview) => void
  vi.mocked(fetchProgressOverview).mockReturnValueOnce(new Promise(yes => { resolve = yes }))
    .mockResolvedValueOnce({ language: 'java', sections: [] })
  const { rerender } = render(<ProgressCharts language="python" />)
  rerender(<ProgressCharts language="java" />)
  await act(async () => resolve(overview))
  expect(screen.queryByText('20%')).toBeNull()
})

it('allows a failed chart request to be retried', async () => {
  vi.mocked(fetchProgressOverview).mockRejectedValueOnce(new Error('Progress unavailable')).mockResolvedValueOnce(overview)
  render(<ProgressCharts language="python" />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByText('Retry progress charts'))
  await screen.findByText('20%')
})
