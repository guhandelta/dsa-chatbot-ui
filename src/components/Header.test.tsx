import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const logout = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

const auth = vi.hoisted(() => ({ role: null as 'student' | 'admin' | 'instructor' | null }))
vi.mock('../lib/auth', () => ({ hasToken: () => false, useAuth: () => ({ user: auth.role ? { role: auth.role } : null, logout }) }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
}))
vi.mock('./ThemeSwitcher', () => ({ default: () => null }))
vi.mock('./PeppercornBadge', () => ({ PeppercornBadge: () => null }))
import Header from './Header'
import { App as HomePage } from '../routes/index'

afterEach(cleanup)

it.each([null, 'student', 'instructor', 'admin'] as const)('shows the Study Room to %s and staff navigation only to staff', (role) => {
  auth.role = role
  render(<Header />)
  expect(screen.getByRole('link', { name: 'Study Room' }).getAttribute('href')).toBe('/chat')
  const staff = role === 'admin' || role === 'instructor'
  expect(Boolean(screen.queryByRole('link', { name: 'Teach' }))).toBe(staff)
  expect(Boolean(screen.queryByRole('link', { name: 'Tech Board' }))).toBe(staff)
  if (staff) expect(screen.getByRole('link', { name: 'Teach' }).getAttribute('href')).toBe('/teach')
  expect(screen.queryByRole('link', { name: 'Train' })).toBeNull()
  expect(Boolean(screen.queryByRole('link', { name: 'Admin' }))).toBe(role === 'admin')
})

it.each([null, 'student', 'instructor', 'admin'] as const)('keeps home page links consistent for %s', (role) => {
  auth.role = role
  render(<HomePage />)
  expect(screen.getByRole('link', { name: 'Open the Study Room' }).getAttribute('href')).toBe('/chat')
  const teach = screen.queryByRole('link', { name: 'Teach' })
  expect(teach?.getAttribute('href') ?? null).toBe(role === 'admin' || role === 'instructor' ? '/teach' : null)
  expect(Boolean(screen.queryByRole('link', { name: 'Tech Board' }))).toBe(role === 'admin' || role === 'instructor')
})

it('logs out and returns to the login page when a learner signs out', () => {
  auth.role = 'student'
  render(<Header />)
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(logout).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith({ to: '/login' })
})
