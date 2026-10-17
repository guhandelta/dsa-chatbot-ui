import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ProblemStatement } from './ProblemStatement'
vi.mock('../lib/api', () => ({
  fetchContentItem: vi.fn().mockResolvedValue({ markdown: '# Lesson\n\n## Worked example\n```javascript\nconst hours = 2;\n```\n\n## Problem\nCompute the total cost.\n\n## Starter code\n```javascript\nfunction totalCost(price, quantity) {}\n```' }),
  getApiErrorMessage: () => 'Could not load',
}))
afterEach(cleanup)
it('preserves the exercise after a worked code example in the server-safe document', async () => {
  render(<ProblemStatement problemId="javascript-path-01-values" />)
  await screen.findByText('Compute the total cost.')
  expect(screen.getByText('function totalCost(price, quantity) {}')).toBeTruthy()
})
