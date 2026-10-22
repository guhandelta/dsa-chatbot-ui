// Every API client wrapper plus the auth interceptors. axios.create returns
// a stub whose interceptors are captured, so the JWT header and the 401
// redirect rules can be exercised directly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const http = vi.hoisted(() => {
  const handlers: {
    request?: (c: { headers: Record<string, string> }) => unknown
    fulfilled?: (r: unknown) => unknown
    rejected?: (e: unknown) => Promise<unknown>
  } = {}
  return {
    handlers,
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: (fn: typeof handlers.request) => { handlers.request = fn } },
      response: {
        use: (ok: typeof handlers.fulfilled, err: typeof handlers.rejected) => {
          handlers.fulfilled = ok
          handlers.rejected = err
        },
      },
    },
  }
})

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: () => http } }
})

import * as api from './api'

describe('request interceptor', () => {
  afterEach(() => localStorage.clear())

  it('attaches the bearer token when logged in', () => {
    localStorage.setItem(api.TOKEN_KEY, 'jwt')
    const cfg = http.handlers.request!({ headers: {} }) as { headers: Record<string, string> }
    expect(cfg.headers.Authorization).toBe('Bearer jwt')
  })

  it('sends no header when logged out', () => {
    const cfg = http.handlers.request!({ headers: {} }) as { headers: Record<string, string> }
    expect(cfg.headers.Authorization).toBeUndefined()
  })
})

describe('response interceptor', () => {
  const original = window.location

  function at(pathname: string) {
    const loc = { pathname, href: `http://app${pathname}` }
    Object.defineProperty(window, 'location', { value: loc, configurable: true })
    return loc
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: original, configurable: true })
    localStorage.clear()
  })

  it('passes successful responses through', () => {
    expect(http.handlers.fulfilled!('res')).toBe('res')
  })

  it('clears the token and redirects on 401 from a protected page', async () => {
    const loc = at('/practice')
    localStorage.setItem(api.TOKEN_KEY, 'stale')
    const err = { response: { status: 401 }, config: {} }
    await expect(http.handlers.rejected!(err)).rejects.toBe(err)
    expect(localStorage.getItem(api.TOKEN_KEY)).toBeNull()
    expect(loc.href).toBe('/login?expired=1')
  })

  it.each(['/login', '/register', '/', '/about'])('does not redirect from %s', async (path) => {
    const loc = at(path)
    await expect(http.handlers.rejected!({ response: { status: 401 }, config: {} })).rejects.toBeTruthy()
    expect(loc.href).toBe(`http://app${path}`)
  })

  it('does not redirect for silent session restores', async () => {
    const loc = at('/practice')
    const err = { response: { status: 401 }, config: { skipAuthRedirect: true } }
    await expect(http.handlers.rejected!(err)).rejects.toBe(err)
    expect(loc.href).toBe('http://app/practice')
  })

  it('leaves the token alone for other errors', async () => {
    at('/practice')
    localStorage.setItem(api.TOKEN_KEY, 'keep')
    await expect(http.handlers.rejected!({ response: { status: 500 } })).rejects.toBeTruthy()
    expect(localStorage.getItem(api.TOKEN_KEY)).toBe('keep')
  })
})

describe('endpoint wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    http.get.mockResolvedValue({ data: { algorithms: ['bfs'] } })
    http.post.mockResolvedValue({ data: 'posted' })
    http.patch.mockResolvedValue({ data: 'patched' })
    http.delete.mockResolvedValue({ data: null })
  })

  it('auth', async () => {
    await api.registerUser('a@x.com', 'pw')
    await api.loginUser('a@x.com', 'pw')
    await api.fetchMe()
    expect(http.post).toHaveBeenCalledWith('/auth/register', { email: 'a@x.com', password: 'pw' })
    expect(http.post).toHaveBeenCalledWith('/auth/login', { email: 'a@x.com', password: 'pw' })
    expect(http.get).toHaveBeenCalledWith('/auth/me', { skipAuthRedirect: true })
  })

  it('chat applies defaults', async () => {
    await api.sendChatMessage({ message: 'hi', provider: 'openai', language: 'python' })
    await api.sendChatMessage({
      message: 'hi', provider: 'claude', language: 'go', threadId: 't', track: 'algorithm', focusId: 'bfs',
    })
    expect(http.post).toHaveBeenNthCalledWith(1, '/chat/', {
      message: 'hi', thread_id: undefined, provider: 'openai', language: 'python',
      mode: 'learn', track: 'dsa', focus_id: undefined,
      subject: undefined, retrieval_mode: 'standard',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(http.post).toHaveBeenNthCalledWith(2, '/chat/', {
      message: 'hi', thread_id: 't', provider: 'claude', language: 'go',
      mode: 'learn', track: 'algorithm', focus_id: 'bfs',
      subject: undefined, retrieval_mode: 'standard',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  it('analyze, problems, training, admin', async () => {
    await api.submitSolution({ problemId: 'p', userCode: 'c', language: 'python', provider: 'openai' })
    expect(http.post).toHaveBeenCalledWith('/analyze/', {
      problem_id: 'p', user_code: 'c', language: 'python', provider: 'openai',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    await api.fetchProblems()
    await api.fetchTrainingStatus()
    await api.submitTraining({ problemId: 'p', problem: 'd', solutions: { python: 'x' }, provider: 'gemini' })
    await api.deleteTrainedProblem('p')
    await api.fetchUsers()
    await api.setUserRole('u', 'teacher')
    expect(http.get).toHaveBeenCalledWith('/problems/')
    expect(http.get).toHaveBeenCalledWith('/training/status')
    expect(http.post).toHaveBeenCalledWith('/training/submit', {
      problem_id: 'p', problem: 'd', solutions: { python: 'x' }, provider: 'gemini',
    })
    expect(http.delete).toHaveBeenCalledWith('/training/problems/p')
    expect(http.get).toHaveBeenCalledWith('/admin/users')
    expect(http.patch).toHaveBeenCalledWith('/admin/users/u/role', { role: 'teacher' })
  })

  it('tracks', async () => {
    await api.fetchTracks()
    await api.fetchTrackItems('dsa')
    await api.fetchTrackItems('dsa', { difficulty: 'Easy' })
    expect(await api.fetchAlgorithmTags()).toEqual(['bfs'])
    await api.fetchAlgorithmPractice('bfs')
    await api.fetchAlgorithmPractice('bfs', 'Hard')
    await api.setPreferredLanguage('rust')
    await api.fetchContentItem('two-sum')
    expect(http.get).toHaveBeenCalledWith('/tracks/')
    expect(http.get).toHaveBeenCalledWith('/tracks/dsa/items', { params: {} })
    expect(http.get).toHaveBeenCalledWith('/tracks/dsa/items', { params: { difficulty: 'Easy' } })
    expect(http.get).toHaveBeenCalledWith('/tracks/algorithms/tags')
    expect(http.get).toHaveBeenCalledWith('/tracks/algorithms/bfs/practice', { params: {} })
    expect(http.get).toHaveBeenCalledWith('/tracks/algorithms/bfs/practice', { params: { difficulty: 'Hard' } })
    expect(http.patch).toHaveBeenCalledWith('/auth/me/language', { language: 'rust' })
    expect(http.get).toHaveBeenCalledWith('/tracks/items/two-sum', { params: { language: undefined } })
    await api.fetchContentItem('two-sum', 'java')
    expect(http.get).toHaveBeenCalledWith('/tracks/items/two-sum', { params: { language: 'java' } })
  })

  it('mentor, profile, subscriptions', async () => {
    await api.askMentor({ problemId: 'p', language: 'python', reasoning: 'r', provider: 'openai' })
    await api.askMentor({ problemId: 'p', language: 'python', reasoning: 'r', provider: 'openai', currentCode: 'x' })
    await api.fetchEntitlement('python')
    await api.fetchLearningProfile()
    await api.recordReflection('p', 'because', 'python')
    await api.deleteLearningProfile()
    await api.exportLearningProfile()
    await api.fetchSubscriptions()
    expect(http.post).toHaveBeenNthCalledWith(1, '/mentor/ask', {
      problem_id: 'p', language: 'python', reasoning: 'r', current_code: '', provider: 'openai',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(http.post).toHaveBeenNthCalledWith(2, '/mentor/ask', {
      problem_id: 'p', language: 'python', reasoning: 'r', current_code: 'x', provider: 'openai',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(http.get).toHaveBeenCalledWith('/mentor/entitlement', { params: { language: 'python' } })
    expect(http.get).toHaveBeenCalledWith('/mentor/profile')
    expect(http.post).toHaveBeenCalledWith('/mentor/reflect', null, {
      params: { problem_id: 'p', reasoning: 'because', language: 'python' },
    })
    expect(http.delete).toHaveBeenCalledWith('/mentor/profile')
    expect(http.get).toHaveBeenCalledWith('/mentor/profile/export')
    expect(http.get).toHaveBeenCalledWith('/subscriptions/')
  })
})

it('serializes mentor and practice hint spending caps including zero', async () => {
  http.post.mockResolvedValue({ data: {} })
  await api.askMentor({ problemId: 'a', language: 'python', reasoning: 'Pairs', provider: 'openai', maxHintCost: 0 })
  expect(http.post).toHaveBeenLastCalledWith('/mentor/ask', expect.objectContaining({ max_hint_cost: 0 }), expect.anything())
  await api.practiceAction('session', 'hint', '', 'Pairs', 2)
  expect(http.post).toHaveBeenLastCalledWith('/practice/sessions/session/actions', expect.objectContaining({ max_hint_cost: 2 }), expect.anything())
})
