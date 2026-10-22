import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DebugCatalog, DebugChallenge } from '../../lib/studyApi'

const api = vi.hoisted(() => ({ fetchDebugCatalog: vi.fn(), nextDebugChallenge: vi.fn(), reviewDebugChallenge: vi.fn() }))
vi.mock('../../lib/studyApi', () => api)
vi.mock('../../lib/api', () => ({ getApiErrorMessage: (e: Error) => e.message }))
import { DebugChallenges } from './DebugChallenges'

const problem = (over: Partial<DebugChallenge> = {}): DebugChallenge => ({
  id: 'bug-1', attempt_id: 'a-1', language: 'python', subject: 'python', difficulty: 'easy',
  title: 'An average is truncated', code: 'return total // count', failure: '7 and 2 produce 3.',
  goal: 'Preserve the fractional result.', source: 'authored', code_language: 'python', status: 'assigned',
  task_kind: 'repair', assessment: 'self-review', automatically_graded: false, ...over,
})
const catalog = (current: DebugChallenge | null = null): DebugCatalog => ({
  language: 'python', difficulties: ['easy','medium','hard','expert','extreme'],
  subjects: ['python','python-fastapi'].map(id => ({ id, levels: ['easy','medium','hard','expert','extreme'].map(d => ({
    difficulty: d as DebugChallenge['difficulty'], total: 10, remaining: 10, reviewed: 0,
    current: id === 'python' && d === 'easy' ? current : null,
  })) })),
})
beforeEach(() => { vi.resetAllMocks(); api.fetchDebugCatalog.mockResolvedValue(catalog()); api.nextDebugChallenge.mockResolvedValue(problem()); api.reviewDebugChallenge.mockResolvedValue({ status: 'reviewed' }) })
afterEach(cleanup)

it('offers all levels and only the server-authorized language/framework subjects', async () => {
  render(<DebugChallenges language="python" onSelect={vi.fn()} />)
  await screen.findByRole('button', { name: 'Get a debugging problem' })
  expect(screen.getByRole('option', { name: 'Extreme' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'FastAPI (Python)' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Java' })).toBeNull()
  expect(api.nextDebugChallenge).not.toHaveBeenCalled()
})

it('draws an unseen problem in the selected framework and difficulty', async () => {
  const select = vi.fn()
  render(<DebugChallenges language="python" onSelect={select} />)
  await screen.findByRole('button', { name: 'Get a debugging problem' })
  fireEvent.change(screen.getByLabelText('Debugging subject'), { target: { value: 'python-fastapi' } })
  fireEvent.change(screen.getByLabelText('Debugging difficulty'), { target: { value: 'extreme' } })
  fireEvent.click(screen.getByRole('button', { name: 'Get a debugging problem' }))
  await screen.findByText('An average is truncated')
  expect(api.nextDebugChallenge).toHaveBeenCalledWith('python','python-fastapi','extreme')
  expect(select).toHaveBeenLastCalledWith(problem())
  expect(screen.getByText(/code is not run or automatically graded/i)).toBeTruthy()
})

it('resumes the saved current problem without drawing another on refresh', async () => {
  api.fetchDebugCatalog.mockResolvedValue(catalog(problem()))
  const select = vi.fn()
  render(<DebugChallenges language="python" onSelect={select} />)
  await screen.findByText('An average is truncated')
  expect(select).toHaveBeenLastCalledWith(problem())
  expect(api.nextDebugChallenge).not.toHaveBeenCalled()
})

it('saves a diagnosis as self-review without claiming a test pass', async () => {
  api.fetchDebugCatalog.mockResolvedValue(catalog(problem()))
  render(<DebugChallenges language="python" onSelect={vi.fn()} />)
  await screen.findByText('An average is truncated')
  const save = screen.getByRole('button', { name: 'Save my diagnosis' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Challenge diagnosis'), { target: { value: 'Integer division truncates. Add a fractional-input regression test.' } })
  fireEvent.click(save)
  await screen.findByText('Diagnosis saved. Choose the next unseen problem or a harder level.')
  expect(api.reviewDebugChallenge).toHaveBeenCalledWith('a-1', 'Integer division truncates. Add a fractional-input regression test.')
  expect(screen.queryByText('Tests passed')).toBeNull()
})

it('does not silently repeat an exhausted level', async () => {
  const value = catalog()
  value.subjects[0].levels[0].remaining = 0
  api.fetchDebugCatalog.mockResolvedValue(value)
  render(<DebugChallenges language="python" onSelect={vi.fn()} />)
  const button = await screen.findByRole('button', { name: 'Get a debugging problem' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(screen.getByText(/opened every problem at this level/i)).toBeTruthy()
})

it('drops stale requests and code when the language changes', async () => {
  let complete!: (item: DebugChallenge) => void
  api.nextDebugChallenge.mockReturnValue(new Promise<DebugChallenge>(resolve => { complete = resolve }))
  const select = vi.fn()
  const view = render(<DebugChallenges language="python" onSelect={select} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Get a debugging problem' }))
  api.fetchDebugCatalog.mockResolvedValue({ language: 'java', difficulties:['easy'], subjects:[] })
  view.rerender(<DebugChallenges language="java" onSelect={select} />)
  await act(async () => { complete(problem()) })
  expect(screen.queryByText('An average is truncated')).toBeNull()
  expect(select).not.toHaveBeenCalledWith(problem())
  await waitFor(() => expect(api.fetchDebugCatalog).toHaveBeenLastCalledWith('java'))
})

it('can return to the existing bring-your-own-code workflow', async () => {
  api.fetchDebugCatalog.mockResolvedValue(catalog(problem()))
  const select = vi.fn()
  render(<DebugChallenges language="python" onSelect={select} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Use my own code' }))
  expect(select).toHaveBeenLastCalledWith(null)
  expect(screen.queryByText('An average is truncated')).toBeNull()
})

it('reports a failed draw without inventing a fallback problem', async () => {
  api.nextDebugChallenge.mockRejectedValue(new Error('Subscription expired'))
  render(<DebugChallenges language="python" onSelect={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Get a debugging problem' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText('Subscription expired')).toBeTruthy()
  expect(screen.queryByLabelText('Current debugging problem')).toBeNull()
})


it('passes the current topic to catalog and draw requests', async () => {
  const value = catalog()
  value.scope = { id:'python:stage-03', title:'Loops and accumulation', kind:'node' }
  api.fetchDebugCatalog.mockResolvedValue(value)
  render(<DebugChallenges language="python" focusId="python:stage-03" onSelect={vi.fn()} />)
  await screen.findByText('Current topic: Loops and accumulation')
  expect(api.fetchDebugCatalog).toHaveBeenCalledWith('python', 'python:stage-03')
  fireEvent.click(screen.getByRole('button', { name:'Get a debugging problem' }))
  await screen.findByText('An average is truncated')
  expect(api.nextDebugChallenge).toHaveBeenCalledWith('python','python','easy','python:stage-03')
})

it('drops an old topic response even when the language stays the same', async () => {
  let complete!: (item: DebugChallenge) => void
  api.nextDebugChallenge.mockReturnValue(new Promise<DebugChallenge>(resolve => { complete = resolve }))
  const select = vi.fn()
  const view = render(<DebugChallenges language="python" focusId="python:stage-01" onSelect={select} />)
  fireEvent.click(await screen.findByRole('button', { name:'Get a debugging problem' }))
  const next = catalog()
  next.scope = { id:'python:stage-05', title:'Strings and iteration', kind:'node' }
  api.fetchDebugCatalog.mockResolvedValue(next)
  view.rerender(<DebugChallenges language="python" focusId="python:stage-05" onSelect={select} />)
  await act(async () => { complete(problem()) })
  await screen.findByText('Current topic: Strings and iteration')
  expect(screen.queryByText('An average is truncated')).toBeNull()
  expect(select).not.toHaveBeenCalledWith(problem())
})

it('starts at an available topic difficulty and does not widen empty levels', async () => {
  const value = catalog()
  value.subjects = [value.subjects[0]]
  value.subjects[0].levels = value.subjects[0].levels.map(l => ({ ...l, total:l.difficulty === 'hard' ? 2 : 0, remaining:l.difficulty === 'hard' ? 2 : 0 }))
  value.scope = { id:'python:module-context-managers', title:'Context managers', kind:'node' }
  api.fetchDebugCatalog.mockResolvedValue(value)
  render(<DebugChallenges language="python" focusId="python:module-context-managers" onSelect={vi.fn()} />)
  await screen.findByText('Current topic: Context managers')
  expect((screen.getByLabelText('Debugging difficulty') as HTMLSelectElement).value).toBe('hard')
  fireEvent.change(screen.getByLabelText('Debugging difficulty'), { target:{ value:'easy' } })
  expect(screen.getByText(/unrelated topics will not be substituted/i)).toBeTruthy()
  expect((screen.getByRole('button', { name:'Get a debugging problem' }) as HTMLButtonElement).disabled).toBe(true)
  expect(api.nextDebugChallenge).not.toHaveBeenCalled()
})
