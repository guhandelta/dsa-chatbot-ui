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
  expect(screen.getByText(/Asking is capped at 0/)).toBeTruthy()
})

it('falls back to the general pricing rule when the price cannot be loaded', async () => {
  mocks.fetchNextHint.mockRejectedValue(new Error('down'))
  const { unmount } = render(<MentorPanel problemId="two-sum" language="python" />)
  expect(await screen.findByText('Price unavailable. Asking is capped at 0 peppercorns; a changed price will be refreshed.')).toBeTruthy()
  unmount()
  let resolve: (v: unknown) => void = () => {}
  let reject: (e: Error) => void = () => {}
  mocks.fetchNextHint.mockReturnValueOnce(new Promise((r) => { resolve = r })).mockReturnValueOnce(new Promise((_, r) => { reject = r }))
  render(<MentorPanel problemId="a" language="python" />).unmount()
  render(<MentorPanel problemId="b" language="python" />).unmount()
  await act(async () => { resolve({ cost: 0 }); reject(new Error('late')) })
})

it('does not let a pending initial lookup overwrite the response price and caps unknown prices at zero', async () => {
  let resolve!: (value: { cost: number }) => void
  mocks.fetchNextHint.mockReturnValueOnce(new Promise(r => { resolve = r }))
  mocks.askMentor.mockResolvedValue(response(2, 2))
  render(<MentorPanel problemId="a" language="python" />)
  await ask('Pairs')
  expect(mocks.askMentor).toHaveBeenCalledWith(expect.objectContaining({ maxHintCost: 0 }))
  await act(async () => { resolve({ cost: 0 }) })
  expect(screen.getByText(/This nudge costs 2/)).toBeTruthy()
  await ask('Next')
  expect(mocks.askMentor).toHaveBeenLastCalledWith(expect.objectContaining({ maxHintCost: 2 }))
})

it.each(['language', 'problem'] as const)('resets the conversation and ignores stale requests on %s changes', async (change) => {
  let resolve!: (value: ReturnType<typeof response>) => void
  mocks.fetchNextHint.mockResolvedValue({ cost: 2 })
  mocks.askMentor.mockResolvedValueOnce(response(1, 2))
    .mockReturnValueOnce(new Promise(r => { resolve = r }))
  const view = render(<MentorPanel problemId="a" language="python" />)
  await ask('First')
  await ask('Pending')
  view.rerender(<MentorPanel problemId={change === 'problem' ? 'b' : 'a'} language={change === 'language' ? 'java' : 'python'} />)
  expect(screen.queryByText('Question at tier 1?')).toBeNull()
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  mocks.setBalance.mockClear()
  await act(async () => { resolve(response(4, 9)) })
  expect(screen.queryByText('Question at tier 4?')).toBeNull()
  expect(mocks.setBalance).not.toHaveBeenCalled()
  expect(screen.queryByText(/costs 9/)).toBeNull()
})

it('refreshes a changed price after 409 before the next request', async () => {
  mocks.fetchNextHint.mockResolvedValueOnce({ cost: 0 }).mockResolvedValueOnce({ cost: 2 })
  mocks.askMentor.mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValueOnce(response(3, 2))
  render(<MentorPanel problemId="a" language="python" />)
  await screen.findByText(/This nudge is free/)
  await ask('Reason')
  expect(await screen.findByText(/This nudge costs 2/)).toBeTruthy()
  await ask('Retry')
  expect(mocks.askMentor).toHaveBeenLastCalledWith(expect.objectContaining({ maxHintCost: 2 }))
})

it('forwards the advertised cap to a practice hint callback', async () => {
  mocks.fetchNextHint.mockResolvedValue({ cost: 2 })
  const requestHint = vi.fn().mockResolvedValue(response(3, 2))
  render(<MentorPanel problemId="a" language="python" requestHint={requestHint} />)
  await screen.findByText(/This nudge costs 2/)
  await ask('Reason')
  expect(requestHint).toHaveBeenCalledWith('Reason', 2)
})

it('ignores old language price and entitlement lookups', async () => {
  let price!: (v: { cost: number }) => void
  let entitlement!: (v: { entitled: boolean; reason: string }) => void
  mocks.fetchNextHint.mockReturnValueOnce(new Promise(r => { price = r })).mockResolvedValueOnce({ cost: 2 })
  mocks.fetchEntitlement.mockReturnValueOnce(new Promise(r => { entitlement = r })).mockResolvedValueOnce({ entitled: true })
  const view = render(<MentorPanel problemId="a" language="python" />)
  view.rerender(<MentorPanel problemId="a" language="java" />)
  await screen.findByText(/This nudge costs 2/)
  await act(async () => { price({ cost: 0 }); entitlement({ entitled: false, reason: 'Old entitlement' }) })
  expect(screen.getByText(/This nudge costs 2/)).toBeTruthy()
  expect(screen.queryByText('Old entitlement')).toBeNull()
})
