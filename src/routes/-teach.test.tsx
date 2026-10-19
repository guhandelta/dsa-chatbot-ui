import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { User } from '../types'
const auth = vi.hoisted(() => ({ role: 'instructor' as string | null, token: true, initializing: false }))
vi.mock('../lib/auth', () => ({ hasToken: () => auth.token, useAuth: () => ({ user: auth.role ? { role: auth.role } : null, initializing: auth.initializing }) }))
vi.mock('@tanstack/react-router', async original => ({
  ...await original<typeof import('@tanstack/react-router')>(),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))
vi.mock('../lib/api', () => ({ fetchMe: vi.fn(), fetchTrainingStatus: vi.fn().mockResolvedValue(null), submitTraining: vi.fn().mockResolvedValue({}), getApiErrorMessage: () => 'Unavailable' }))
vi.mock('@monaco-editor/react', () => ({ default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <textarea aria-label="Solution" value={value} onChange={e => onChange(e.target.value)} /> }))
vi.mock('../components/KnowledgeUploadPanel', () => ({ KnowledgeUploadPanel: ({ isAdmin }: { isAdmin: boolean }) => <p>Reference uploads: {isAdmin ? 'publish' : 'review'}</p> }))
vi.mock('../components/ValidationReportView', () => ({ ValidationReportView: () => <p>Validation report</p> }))
import { Route, TeachPage } from './teach'
import { Route as LegacyRoute } from './train'
import { fetchMe, fetchTrainingStatus, submitTraining } from '../lib/api'
const guard = () => (Route.options.beforeLoad as () => Promise<unknown>)()
const legacy = () => (LegacyRoute.options.beforeLoad as () => Promise<unknown>)()
beforeEach(() => { vi.clearAllMocks(); auth.role = 'instructor'; auth.token = true; auth.initializing = false })
afterEach(cleanup)
it.each(['admin', 'instructor'] as const)('allows %s at /teach and redirects legacy /train', async role => {
  vi.mocked(fetchMe).mockResolvedValue({ role } as User)
  await expect(guard()).resolves.toBeUndefined()
  await expect(legacy()).rejects.toMatchObject({ options: { to: '/teach', replace: true } })
  auth.role = role
  render(<TeachPage />)
  expect(screen.getByText(`Reference uploads: ${role === 'admin' ? 'publish' : 'review'}`)).toBeTruthy()
  await waitFor(() => expect(fetchTrainingStatus).toHaveBeenCalledOnce())
})
it.each([guard, legacy])('rejects students and guests before rendering teaching tools', async beforeLoad => {
  vi.mocked(fetchMe).mockResolvedValue({ role: 'student' } as User)
  await expect(beforeLoad()).rejects.toMatchObject({ options: { to: '/learn' } })
  auth.token = false
  vi.mocked(fetchMe).mockClear()
  await expect(beforeLoad()).rejects.toMatchObject({ options: { to: '/login' } })
  expect(fetchMe).not.toHaveBeenCalled()
})
it.each(['student', null])('does not mount training tools or fetch status for %s', role => {
  auth.role = role
  render(<TeachPage />)
  expect(screen.queryByRole('button', { name: 'Submit for verification' })).toBeNull()
  expect(screen.queryByText(/Reference uploads:/)).toBeNull()
  expect(fetchTrainingStatus).not.toHaveBeenCalled()
})
it('submits the problem and only populated solutions and displays validation', async () => {
  render(<TeachPage />)
  fireEvent.change(screen.getByLabelText('Problem ID (slug)'), { target: { value: 'two-sum' } })
  fireEvent.change(screen.getByLabelText('Problem statement'), { target: { value: 'Find two numbers with the target sum.' } })
  fireEvent.change(screen.getByLabelText('Solution'), { target: { value: 'return [0, 1]' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }))
  await screen.findByText('Validation report')
  expect(submitTraining).toHaveBeenCalledWith({ problemId: 'two-sum', problem: 'Find two numbers with the target sum.', solutions: { python: 'return [0, 1]' }, provider: 'gemini' })
})
