import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LearningSupportProvider, practiceTopicKey, storageKey } from '../lib/learningSupport'
import { QuizMode } from './study/QuizMode'
import { startQuiz, answerQuiz, type QuizStarted, type QuizResult } from '../lib/studyApi'
import { useAutosave } from './workspace/useAutosave'
import { saveWorkspace } from '../lib/workspaceApi'
import { renderHook } from '@testing-library/react'
import { LearningSupport } from './LearningSupport'

const route = vi.hoisted(() => ({ pathname: '/learn', href: '/learn' }))
const auth = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null, setBalance: vi.fn() }))
vi.mock('../lib/auth', () => ({ useAuth: () => auth }))
vi.mock('@tanstack/react-router', () => ({ useLocation: () => route }))
vi.mock('../lib/studyApi', () => ({ startQuiz: vi.fn(), answerQuiz: vi.fn() }))
vi.mock('../lib/workspaceApi', () => ({ saveWorkspace: vi.fn() }))

const started: QuizStarted = { quiz_id: 'q1', node_id: 'python:stage-01', node_title: 'Values', total: 1,
  items: [{ id: 'i1', prompt: 'What is 2 + 2?', type: 'short_answer', concept: 'arithmetic', source: 'authored', level: 'L1' }] }
const correct: QuizResult = { item_id: 'i1', correct: true, score: 1, grading: 'exact', feedback: 'Correct.', expected: '4', explanation: '',
  answered: 1, total: 1, complete: true, rewards: [] }
const quiz = () => <LearningSupportProvider owner="alice" fallback={{ id: 'values', title: 'Values' }}><QuizMode language="python" focusId="python:stage-01" /></LearningSupportProvider>
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); auth.user = { id: 'alice' }; route.pathname = '/learn'; route.href = '/learn' })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('restores the exact quiz and unsent answer after pause and reload without starting another quiz', async () => {
  vi.mocked(startQuiz).mockResolvedValue(started)
  vi.mocked(answerQuiz).mockResolvedValue(correct)
  const view = render(quiz())
  fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))
  fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Pause and save' }))
  await screen.findByRole('button', { name: 'Resume learning' })
  view.unmount()
  render(quiz())
  expect((screen.getByLabelText('Your answer') as HTMLInputElement).value).toBe('4')
  expect(startQuiz).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Resume learning' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  await screen.findByLabelText('Quiz summary')
  expect(answerQuiz).toHaveBeenCalledWith('q1', 'i1', '4')
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1'))
})

it('restores the graded quiz summary without grading again or crediting rewards again', async () => {
  vi.mocked(startQuiz).mockResolvedValue(started)
  vi.mocked(answerQuiz).mockResolvedValue(correct)
  const view = render(quiz())
  fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))
  fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
  await screen.findByLabelText('Quiz summary')
  view.unmount()
  render(quiz())
  expect(screen.getByLabelText('Quiz summary')).toBeTruthy()
  expect(answerQuiz).toHaveBeenCalledTimes(1)
  expect(auth.setBalance).not.toHaveBeenCalled()
})

it('ignores corrupted saved quizzes rather than crashing the lesson', () => {
  localStorage.setItem(storageKey('alice', 'draft:quiz:python:python:stage-01'), JSON.stringify({ quiz: { items: [] }, index: 999, results: [], result: null }))
  render(quiz())
  expect(screen.getByRole('button', { name: 'Start quiz' })).toBeTruthy()
})

it('links back to a paused task and rejects external or cross-account resume links', () => {
  localStorage.setItem(storageKey('alice', 'last-pause'), JSON.stringify({ href: '/practice?problem=two-sum&language=python', title: 'Two Sum' }))
  const view = render(<LearningSupport><p>Course</p></LearningSupport>)
  expect(screen.getByRole('link', { name: 'Continue saved task: Two Sum' }).getAttribute('href')).toContain('/practice?')
  auth.user = { id: 'bob' }; view.rerender(<LearningSupport><p>Course</p></LearningSupport>)
  expect(screen.queryByRole('link')).toBeNull()
  auth.user = { id: 'alice' }
  for (const href of ['https://evil.example', '//evil.example', '/chat\\evil', '/admin']) {
    localStorage.setItem(storageKey('alice', 'last-pause'), JSON.stringify({ href, title: 'unsafe' }))
    view.rerender(<LearningSupport><p>Course</p></LearningSupport>)
    expect(screen.queryByRole('link')).toBeNull()
  }
})

it('only shows learning support in authenticated learning routes', () => {
  const view = render(<LearningSupport><p>Content</p></LearningSupport>)
  expect(screen.getByRole('complementary', { name: 'Learning support' })).toBeTruthy()
  route.pathname = '/teach'; route.href = '/teach'; view.rerender(<LearningSupport><p>Content</p></LearningSupport>)
  expect(screen.queryByRole('complementary')).toBeNull()
  route.pathname = '/learn'; auth.user = null; view.rerender(<LearningSupport><p>Content</p></LearningSupport>)
  expect(screen.queryByRole('complementary')).toBeNull()
})

it('shares progress between a foundation lesson, quiz and its coding exercise', () => {
  expect(practiceTopicKey('python-path-01-values', 'python')).toBe('study:python:python:stage-01')
  expect(practiceTopicKey('two-sum', 'python')).toBe('practice:python:two-sum')
  expect(practiceTopicKey('javascript-path-01-values', 'python')).toBe('practice:python:javascript-path-01-values')
})

it('checked saves expose network errors instead of treating a swallowed autosave failure as saved', async () => {
  vi.mocked(saveWorkspace).mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useAutosave('two-sum', 'python', true, 60_000))
  act(() => result.current.schedule({ files: [{ name: 'solution.py', content: 'unfinished' }], entry: 'solution.py', template: 'single' }))
  await act(async () => { await expect(result.current.flushChecked()).rejects.toThrow('unsaved changes') })
  expect(result.current.status).toBe('error')
  vi.mocked(saveWorkspace).mockResolvedValue({ revision: 2, updated_at: '2026-10-29' })
  await act(async () => result.current.flushChecked())
  expect(result.current.status).toBe('saved')
})

it('checked saves wait for in-flight saves and include the latest queued edit', async () => {
  let resolve!: (value: { revision: number; updated_at: string }) => void
  vi.mocked(saveWorkspace).mockImplementationOnce(() => new Promise(done => { resolve = done })).mockResolvedValue({ revision: 3, updated_at: '' })
  const { result } = renderHook(() => useAutosave('two-sum', 'python', true, 60_000))
  act(() => result.current.schedule({ files: [{ name: 's.py', content: 'first' }], entry: 's.py', template: 'single' }))
  let first!: Promise<void>
  act(() => { first = result.current.flush() })
  act(() => result.current.schedule({ files: [{ name: 's.py', content: 'latest' }], entry: 's.py', template: 'single' }))
  await act(async () => { resolve({ revision: 2, updated_at: '' }); await first; await result.current.flushChecked() })
  expect(saveWorkspace).toHaveBeenCalledTimes(2)
  expect(vi.mocked(saveWorkspace).mock.calls[1][1].files[0].content).toBe('latest')
})
