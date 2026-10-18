import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosHeaders } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AdminPage } from './admin'
import { api } from '../lib/api'

const auth = vi.hoisted(() => ({ role: 'admin' as string | null, initializing: false }))
vi.mock('../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: auth.role ? { id: 'admin', email: 'admin@example.com', role: auth.role } : null, initializing: auth.initializing }) }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
const originalAdapter = api.defaults.adapter
const calls: string[] = []
const overview = { generated_at: '2026-10-17T12:00:00Z', days: 7, users_by_role: { student: 2, instructor: 1, admin: 1 }, entitled_students: 1, active_students: 1, pending_documents: 0, training_needs_review: 0, service_failures: 0, oldest_pending_at: null, expiring_subscriptions: 0, operations: {}, stuck_operations: 0, cleanup_jobs: 0, busy_practice_sessions: 0, suspended_users: 0, ledger_mismatches: 0, credits_added: 50, credits_spent: 0, credits_refunded: 0, learning_events: {}, trace_sample: { sampled: 0, total: 0, p95_ms: null, estimated_cost_usd: null, tokens: null, coverage: 'No traces measured.' } }
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminPage /></QueryClientProvider>) }
beforeEach(() => {
  auth.role = 'admin'; auth.initializing = false; calls.length = 0
  api.defaults.adapter = async config => {
    calls.push(config.url!)
    const data = config.url === '/admin/overview' ? overview : { items: [], total: 0, limit: 20, offset: 0 }
    return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config }
  }
})
afterEach(() => { cleanup(); api.defaults.adapter = originalAdapter })

it.each(['student', 'instructor', null])('does not fetch dashboard data for %s', (role) => {
  auth.role = role
  mount()
  expect(screen.getByText('Admin access required')).toBeTruthy()
  expect(calls).toEqual([])
})

it('waits for auth restoration before querying admin data', () => {
  auth.initializing = true
  mount()
  expect(screen.getByText('Checking admin access…')).toBeTruthy()
  expect(calls).toEqual([])
})

it('renders real overview metrics and switches to the people workspace', async () => {
  mount()
  await screen.findByText('Students with access')
  expect(screen.getByText('Document review queue is clear')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'People & access' }))
  await screen.findByText('No accounts match these filters.')
  expect(calls).toContain('/admin/accounts')
})

it('opens the gift workspace from the peppercorn navigation', async () => {
  mount()
  await screen.findByText('Students with access')
  fireEvent.click(screen.getByRole('button', { name: 'Peppercorns' }))
  expect(screen.getByRole('heading', { name: 'Gift peppercorns' })).toBeTruthy()
  await screen.findByText('No students match this search.')
  expect(screen.getByText('No balance discrepancies')).toBeTruthy()
})
