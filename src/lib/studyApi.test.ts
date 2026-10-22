import { beforeEach, describe, expect, it, vi } from 'vitest'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), reliablePost: vi.fn() }))
vi.mock('./api', () => ({ api: { get: http.get, post: http.post }, reliablePost: http.reliablePost }))

import * as study from './studyApi'

beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockResolvedValue({ data: { notes: ['n'], ok: true } })
  http.post.mockResolvedValue({ data: { ok: true } })
  http.reliablePost.mockResolvedValue({ data: { answer: 'a' } })
})

describe('study API client', () => {
  it('reads the path, lessons, allowance, next step, notes, insights and hint price', async () => {
    await study.fetchStudyPath('python')
    expect(http.get).toHaveBeenLastCalledWith('/study/path', { params: { language: 'python' } })
    await study.fetchNodeLesson('python:stage-01', 'python')
    expect(http.get).toHaveBeenLastCalledWith('/study/nodes/python%3Astage-01/lesson', { params: { language: 'python' } })
    await study.fetchAllowance()
    expect(http.get).toHaveBeenLastCalledWith('/study/allowance', { silentError: true })
    await study.fetchNextStep('java')
    expect(http.get).toHaveBeenLastCalledWith('/study/next', { params: { language: 'java' } })
    expect(await study.fetchStudyNotes('java')).toEqual(['n'])
    await study.fetchInsights('java')
    expect(http.get).toHaveBeenLastCalledWith('/study/insights', { params: { language: 'java' } })
    await study.fetchQuizSummary('q/1')
    expect(http.get).toHaveBeenLastCalledWith('/study/quiz/q%2F1')
    await study.fetchNextHint('two-sum', 'python')
    expect(http.get).toHaveBeenLastCalledWith('/mentor/next-hint', { params: { problem_id: 'two-sum', language: 'python' } })
  })

  it('sends study messages with an idempotency-safe post and defaults optional fields', async () => {
    expect(await study.sendStudyMessage({ language: 'python', mode: 'explain', message: 'hi', provider: 'auto' })).toEqual({ answer: 'a' })
    expect(http.reliablePost).toHaveBeenCalledWith('/study/message', {
      language: 'python', mode: 'explain', message: 'hi', thread_id: undefined, focus_id: undefined,
      compare_language: undefined, code: '', error: '', provider: 'auto',
    })
    await study.sendStudyMessage({ language: 'python', mode: 'debug', message: 'm', provider: 'auto', code: 'c', error: 'e', threadId: 't', focusId: 'f', compareLanguage: 'java' })
    expect(http.reliablePost).toHaveBeenLastCalledWith('/study/message', expect.objectContaining({ code: 'c', error: 'e', thread_id: 't', focus_id: 'f', compare_language: 'java' }))
  })

  it('posts quiz, answer and debug resolution requests', async () => {
    await study.startQuiz('python', 'python:stage-02', 3)
    expect(http.post).toHaveBeenLastCalledWith('/study/quiz', { language: 'python', node_id: 'python:stage-02', count: 3 })
    await study.answerQuiz('q1', 'item', 2)
    expect(http.post).toHaveBeenLastCalledWith('/study/quiz/q1/answer', { item_id: 'item', response: 2 })
    await study.resolveDebug('t1', 'my fix')
    expect(http.post).toHaveBeenLastCalledWith('/study/debug/resolve', { thread_id: 't1', fix: 'my fix' })
  })
})

it('loads, draws, and self-reviews language-scoped debugging challenges', async () => {
  await study.fetchDebugCatalog('java')
  expect(http.get).toHaveBeenLastCalledWith('/study/debug/challenges', { params: { language: 'java' } })
  await study.nextDebugChallenge('java', 'spring-data', 'extreme')
  expect(http.post).toHaveBeenLastCalledWith('/study/debug/challenges/next', { language: 'java', subject: 'spring-data', difficulty: 'extreme' })
  await study.reviewDebugChallenge('attempt/1', 'A diagnosis and a regression test.')
  expect(http.post).toHaveBeenLastCalledWith('/study/debug/challenges/attempt%2F1/review', { diagnosis: 'A diagnosis and a regression test.' })
})


it('passes the selected topic to debugging catalog and draw requests', async () => {
  await study.fetchDebugCatalog('java','java:stage-07')
  expect(http.get).toHaveBeenLastCalledWith('/study/debug/challenges', { params:{ language:'java', focus_id:'java:stage-07' } })
  await study.nextDebugChallenge('java','java','medium','java:stage-07')
  expect(http.post).toHaveBeenLastCalledWith('/study/debug/challenges/next', { language:'java', subject:'java', difficulty:'medium', focus_id:'java:stage-07' })
})
