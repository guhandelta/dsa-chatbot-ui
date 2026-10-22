import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LearningTips } from './LearningTips'
import type { LearningGuidance } from '../../lib/studyApi'

afterEach(cleanup)
it('keeps focus and strengths in separate sections with evidence and actions', () => {
  const onOpen = vi.fn()
  const guidance: LearningGuidance = {
    focus: [{ title: 'Hone indexing', evidence: '2 of 3 distinct answers missed.', tip: 'Trace a boundary case.', action: { label: 'Review indexing', mode: 'explain', focus: 'javascript:stage-06' } }],
    strengths: [{ title: 'Build on copying', evidence: '4 of 4 distinct answers correct.', tip: 'Combine arrays and strings.', action: { label: 'Explore combinations', mode: 'explain', focus: 'explain:javascript:arrays-strings' } }],
    strengths_empty: '', evidence_note: 'Latest distinct answers only.',
  }
  render(<LearningTips guidance={guidance} onOpen={onOpen} />)
  expect(screen.getByLabelText('Focus and hone your skills').textContent).toContain('Hone indexing')
  expect(screen.getByLabelText('Build on your strengths').textContent).toContain('Build on copying')
  fireEvent.click(screen.getByText('Explore combinations'))
  expect(onOpen).toHaveBeenCalledWith('explain', 'explain:javascript:arrays-strings')
})

it('does not invent a strength when assessment evidence is missing', () => {
  render(<LearningTips onOpen={vi.fn()} />)
  expect(screen.getByText(/not enough assessment evidence/)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})
