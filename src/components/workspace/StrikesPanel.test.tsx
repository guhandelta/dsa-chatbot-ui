import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrikesPanel, describeWhere } from './StrikesPanel'
import { answerChallenge, fetchStrikes, startExtraPractice, type Strike, type StrikeOverview } from '../../lib/strikesApi'

vi.mock('../../lib/strikesApi', () => ({ fetchStrikes: vi.fn(), answerChallenge: vi.fn(), startExtraPractice: vi.fn() }))
vi.mock('../../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))

const set = {
  id: 'set1', kind: 'strike' as const, node_id: 'python:stage-01', problem_id: 'p', required: 2, correct: 0, answered: 0, complete: false,
  questions: [
    { id: 'q1', type: 'mcq' as const, format: 'mcq' as const, prompt: 'Which is an int?', concept: 'floor-division', choices: ['7 / 2', '7 // 2'], answered: false, correct: false },
    { id: 'q2', type: 'fix_bug' as const, format: 'debug' as const, prompt: 'Fix the loop', concept: 'loops', starter: 'def f():\n    pass', function: 'f', test_count: 3, answered: false, correct: false },
  ],
}
const strike: Strike = { id: 's1', problem_id: 'p', node_id: 'python:stage-01', source: 'evaluation', status: 'open',
  where: { stage: 'evaluation', format: 'coding', phase: 'wrong_answer', passed: 2, total: 6 }, created_at: '', set, clearable: true }
const overview = (open: Strike[] = [strike]): StrikeOverview => ({ language: 'python', cap: 4, cap_action: 'mentor_step_back', open, blocking: open.length > 0,
  extra_practice: { remaining_this_month: 5, per_month: 40, sets: 0, correct: 0, answered: 0 } })

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchStrikes).mockResolvedValue(overview()) })

it('describes where each mistake happened', () => {
  expect(describeWhere({ stage: 'evaluation', format: 'coding', phase: 'run', line: 4, passed: 0, total: 6 })).toBe('The code crashed while running the tests, line 4 (0/6 tests passed).')
  expect(describeWhere({ stage: 'challenge', format: 'debug', concept: 'off-by-one' })).toBe('Missed a debugging question on off by one.')
})

it('shows open strikes with their clearing questions and answers them', async () => {
  vi.mocked(answerChallenge).mockResolvedValue({ correct: false, feedback: 'Not quite.', cleared: false, replacement: null, renewed_set: null,
    cap_reached: null, new_strike: { ...strike, id: 's2' }, set })
  render(<StrikesPanel language="python" problemId="p" refreshKey={0} />)
  expect(await screen.findByText('Wrong answers in the evaluation (2/6 tests passed).')).toBeTruthy()
  expect(screen.getByText('Clear these to unlock your next challenge.')).toBeTruthy()
  expect(screen.getByText('0 of 2 correct answers needed.')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('7 / 2'))
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Submit answer' })[0]) })
  expect(answerChallenge).toHaveBeenCalledWith('set1', 'q1', 0)
  expect(screen.getByText('That answer earned another strike. A new question was added.', { selector: 'p.ev-fail' })).toBeTruthy()
  expect(fetchStrikes).toHaveBeenCalledTimes(2)
})

it('submits code for coding and debugging questions and reports the cap', async () => {
  vi.mocked(answerChallenge).mockResolvedValue({ correct: false, feedback: '', cleared: false, replacement: null, renewed_set: null, new_strike: null, set,
    cap_reached: { action: 'mentor_step_back', message: "You've reached the strike limit on this topic.", prerequisite: { id: 'n0', title: 'Getting started' } } })
  render(<StrikesPanel language="python" problemId="p" refreshKey={0} />)
  const code = await screen.findByRole('textbox', { name: 'Your code' })
  fireEvent.change(code, { target: { value: 'def f():\n    return 1' } })
  await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Submit answer' })[1]) })
  expect(answerChallenge).toHaveBeenCalledWith('set1', 'q2', 'def f():\n    return 1')
  expect(screen.getByText(/strike limit/, { selector: 'p.ev-fail' })).toBeTruthy()
  expect(screen.getByText('Earlier lesson to revisit: Getting started')).toBeTruthy()
})

it('offers extra practice without strikes and respects the monthly cap', async () => {
  vi.mocked(fetchStrikes).mockResolvedValue(overview([]))
  vi.mocked(startExtraPractice).mockResolvedValue({ ...set, id: 'x1', kind: 'extra' })
  render(<StrikesPanel language="python" problemId="p" refreshKey={0} />)
  expect(await screen.findByText(/No open strikes/)).toBeTruthy()
  expect(screen.getByText(/5 of 40 sets left this month/)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Practise this topic more' })) })
  expect(startExtraPractice).toHaveBeenCalledWith('python', 'p')
  expect(screen.getByText('Which is an int?')).toBeTruthy()
  cleanup()
  vi.mocked(fetchStrikes).mockResolvedValue({ ...overview([]), extra_practice: { ...overview([]).extra_practice, remaining_this_month: 0 } })
  render(<StrikesPanel language="python" problemId="p" refreshKey={0} />)
  expect((await screen.findByRole('button', { name: 'Practise this topic more' }) as HTMLButtonElement).disabled).toBe(true)
})
