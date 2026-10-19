// Mentor pricing: hints 1-2 are free on every problem, hints 3-4 are charged.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ askMentor: vi.fn(), fetchEntitlement: vi.fn(), fetchNextHint: vi.fn(), setBalance: vi.fn() }))
vi.mock('../lib/api', () => ({ askMentor: mocks.askMentor, fetchEntitlement: mocks.fetchEntitlement, getApiErrorMessage: () => 'failed' }))
vi.mock('../lib/studyApi', () => ({ fetchNextHint: mocks.fetchNextHint }))
vi.mock('../lib/auth', () => ({ useAuth: () => ({ setBalance: mocks.setBalance }) }))

import { MentorPanel } from './MentorPanel'

const response = (tier: number, next: number | undefined) => ({
  reply: `Question at tier ${tier}?`, hint_tier: tier, tier_label: 'Orient', recalled_moment: null, step_back_offer: null,
  peppercorns_remaining: 50, peppercorns_charged: 0, next_hint_cost: next,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchEntitlement.mockResolvedValue({ entitled: true, reason: '' })
})
afterEach(cleanup)

async function ask(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ask|another nudge/ })) })
}

it('shows that the next nudge is free, then charged, from the server price', async () => {
  mocks.fetchNextHint.mockResolvedValue({ tier: 2, tier_label: 'Probe the gap', cost: 0, free_tiers: 2, max_tier: 4 })
  mocks.askMentor.mockResolvedValueOnce(response(2, 2)).mockResolvedValueOnce(response(3, undefined))
  render(<MentorPanel problemId="two-sum" language="python" />)
  expect(await screen.findByText(/This nudge is free/)).toBeTruthy()
  expect(mocks.fetchNextHint).toHaveBeenCalledWith('two-sum', 'python')
  await ask('I loop over pairs')
  expect(await screen.findByText('This nudge costs 2 peppercorns (hints 3–4 are charged).')).toBeTruthy()
  await ask('Still stuck')
  expect(screen.getByText(/costs 2 peppercorns/)).toBeTruthy()
})

it('falls back to the general pricing rule when the price cannot be loaded', async () => {
  mocks.fetchNextHint.mockRejectedValue(new Error('down'))
  const { unmount } = render(<MentorPanel problemId="two-sum" language="python" />)
  expect(await screen.findByText('Hints 1–2 are free on every problem; hints 3–4 cost 2 peppercorns.')).toBeTruthy()
  unmount()
  let resolve: (v: unknown) => void = () => {}
  let reject: (e: Error) => void = () => {}
  mocks.fetchNextHint.mockReturnValueOnce(new Promise((r) => { resolve = r })).mockReturnValueOnce(new Promise((_, r) => { reject = r }))
  render(<MentorPanel problemId="a" language="python" />).unmount()
  render(<MentorPanel problemId="b" language="python" />).unmount()
  await act(async () => { resolve({ cost: 0 }); reject(new Error('late')) })
})
