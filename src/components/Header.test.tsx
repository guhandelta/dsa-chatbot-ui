import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ role: null as 'student' | 'admin' | 'instructor' | null }))
vi.mock('../lib/auth', () => ({ hasToken: () => false, useAuth: () => ({ user: auth.role ? { role: auth.role } : null, logout: vi.fn() }) }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))
vi.mock('./ThemeToggle', () => ({ default: () => null }))
vi.mock('./PeppercornBadge', () => ({ PeppercornBadge: () => null }))
import Header from './Header'
import { App as HomePage } from '../routes/index'

afterEach(cleanup)

it.each([null, 'student', 'instructor', 'admin'] as const)('shows Chat to %s and staff navigation only to staff', (role) => {
  auth.role = role
  render(<Header />)
  expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('href')).toBe('/chat')
  const staff = role === 'admin' || role === 'instructor'
  expect(Boolean(screen.queryByRole('link', { name: 'Train' }))).toBe(staff)
  expect(Boolean(screen.queryByRole('link', { name: 'Tech Board' }))).toBe(staff)
  expect(Boolean(screen.queryByRole('link', { name: 'Admin' }))).toBe(role === 'admin')
})

it.each([null, 'student', 'instructor', 'admin'] as const)('keeps home page links consistent for %s', (role) => {
  auth.role = role
  render(<HomePage />)
  expect(screen.getByRole('link', { name: 'Chat with your tutor' }).getAttribute('href')).toBe('/chat')
  expect(Boolean(screen.queryByRole('link', { name: 'Tech Board' }))).toBe(role === 'admin' || role === 'instructor')
})
