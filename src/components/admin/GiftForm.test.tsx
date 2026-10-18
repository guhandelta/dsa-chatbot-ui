import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { GiftForm } from './PeopleCredits'
import { giftPeppercorns } from '../../lib/adminApi'
import type { User } from '../../types'

vi.mock('../../lib/adminApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/adminApi')>(), giftPeppercorns: vi.fn(),
}))
const student: User = { id: 'student-1', email: 'learner@example.com', role: 'student', peppercorns: 20, preferred_language: 'java', status: 'active' }
function mount(user = student) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })}><GiftForm student={user} /></QueryClientProvider>) }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(giftPeppercorns).mockResolvedValue({ ...student, peppercorns: 120 }) })
afterEach(cleanup)

it('requires a reason and a recipient review before sending a gift', async () => {
  mount()
  expect((screen.getByRole('button', { name: 'Review gift' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Peppercorn amount'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('Reason for gift'), { target: { value: 'Learning milestone' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review gift' }))
  expect(giftPeppercorns).not.toHaveBeenCalled()
  expect(screen.getByText('+100 peppercorns')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm gift' }))
  await waitFor(() => expect(screen.getByText('Gift delivered')).toBeTruthy())
  expect(giftPeppercorns).toHaveBeenCalledExactlyOnceWith(student.id, 100, 'Learning milestone')
})

it('locks duplicate submissions while a gift is pending', async () => {
  let settle!: (value: User) => void
  vi.mocked(giftPeppercorns).mockImplementation(() => new Promise(resolve => { settle = resolve }))
  mount()
  fireEvent.change(screen.getByLabelText('Reason for gift'), { target: { value: 'Support credit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review gift' }))
  const button = screen.getByRole('button', { name: 'Confirm gift' })
  fireEvent.click(button); fireEvent.click(button)
  await waitFor(() => expect(giftPeppercorns).toHaveBeenCalledTimes(1))
  settle(student)
  await waitFor(() => expect(screen.getByText('Gift delivered')).toBeTruthy())
})

it('retains the same reviewed gift after an uncertain network result', async () => {
  vi.mocked(giftPeppercorns).mockRejectedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'))
  mount()
  fireEvent.change(screen.getByLabelText('Reason for gift'), { target: { value: 'Welcome credit' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review gift' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm gift' }))
  await screen.findByRole('button', { name: 'Retry this gift' })
  expect(screen.queryByRole('button', { name: 'Edit gift' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry this gift' }))
  await waitFor(() => expect(screen.getByText('Gift delivered')).toBeTruthy())
  expect(vi.mocked(giftPeppercorns).mock.calls[0]).toEqual(vi.mocked(giftPeppercorns).mock.calls[1])
})

it('does not offer a gift form for a non-student account', () => {
  mount({ ...student, role: 'instructor' })
  expect(screen.queryByRole('button', { name: 'Review gift' })).toBeNull()
})
