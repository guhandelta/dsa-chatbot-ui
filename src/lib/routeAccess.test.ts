import { beforeEach, expect, it, vi } from 'vitest'
import type { User } from '../types'

const auth = vi.hoisted(() => ({ token: true }))
vi.mock('./auth', () => ({ hasToken: () => auth.token }))
vi.mock('./api', () => ({ fetchMe: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ redirect: (options: { to: string }) => ({ redirect: options.to }) }))
import { fetchMe } from './api'
import { requireTeachingAccess } from './routeAccess'

beforeEach(() => { vi.resetAllMocks(); auth.token = true })

it('redirects guests to login before making a request', async () => {
  auth.token = false
  await expect(requireTeachingAccess()).rejects.toEqual({ redirect: '/login' })
  expect(fetchMe).not.toHaveBeenCalled()
})

it('redirects students away from staff pages using their current server role', async () => {
  vi.mocked(fetchMe).mockResolvedValue({ role: 'student' } as User)
  await expect(requireTeachingAccess()).rejects.toEqual({ redirect: '/learn' })
})

it.each(['admin', 'instructor'] as const)('allows %s to open staff routes', async (role) => {
  vi.mocked(fetchMe).mockResolvedValue({ role } as User)
  await expect(requireTeachingAccess()).resolves.toBeUndefined()
})

it('redirects expired sessions to login', async () => {
  vi.mocked(fetchMe).mockRejectedValue({ isAxiosError: true, response: { status: 401 } })
  await expect(requireTeachingAccess()).rejects.toEqual({ redirect: '/login' })
})

it('does not grant access when the role request fails', async () => {
  vi.mocked(fetchMe).mockRejectedValue(new Error('Unavailable'))
  await expect(requireTeachingAccess()).rejects.toThrow('Unavailable')
})
