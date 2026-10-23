import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { EvidenceSection } from './EvidenceSection'
import * as studyApi from '../../lib/studyApi'

vi.mock('../../lib/studyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/studyApi')>()),
  fetchEvidence: vi.fn(),
}))

const item = {
  concept: 'digit-sum', item_id: 'c-s01-fix', item_type: 'fix_bug',
  code: 'int digitSum(int n) { return n % 10 + digitSum(n / 10); }', passed_at: '2026-10-23T00:00:00Z',
}

describe('EvidenceSection', () => {
  beforeEach(() => vi.mocked(studyApi.fetchEvidence).mockReset())
  afterEach(cleanup)

  it('shows a loading state, then the learner code for each concept', async () => {
    vi.mocked(studyApi.fetchEvidence).mockResolvedValue([item])
    render(<EvidenceSection language="c" />)
    expect(screen.getByRole('status').textContent).toContain('Loading your code')
    expect(await screen.findByText(/digit-sum/)).toBeTruthy()
    expect(screen.getByLabelText('Your code for digit-sum').textContent).toContain('return n % 10')
  })

  it('shows the empty state with guidance when nothing is evidenced yet', async () => {
    vi.mocked(studyApi.fetchEvidence).mockResolvedValue([])
    render(<EvidenceSection language="c" />)
    expect(await screen.findByText(/Nothing yet/)).toBeTruthy()
  })

  it('shows an error alert when the request fails', async () => {
    vi.mocked(studyApi.fetchEvidence).mockRejectedValueOnce(new Error('network down'))
    render(<EvidenceSection language="c" />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  })

  it('renders learner code as text, never as markup', async () => {
    vi.mocked(studyApi.fetchEvidence).mockResolvedValue([{ ...item, code: '<img src=x onerror="alert(1)">' }])
    const { container } = render(<EvidenceSection language="c" />)
    await screen.findByText(/digit-sum/)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByLabelText('Your code for digit-sum').textContent).toContain('<img src=x')
  })
})
