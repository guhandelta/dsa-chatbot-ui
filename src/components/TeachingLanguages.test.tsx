import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../lib/api', () => ({
  fetchAdminLanguages: vi.fn().mockResolvedValue(['java','javascript']),
  fetchTeachingAccess: vi.fn().mockResolvedValue({ assigned_languages: ['java'], languages: ['java'] }),
  saveTeachingLanguages: vi.fn().mockResolvedValue({ assigned_languages: ['java','javascript'], languages: ['java','javascript'] }),
  getApiErrorMessage: () => 'Access could not be saved.',
}))
import { saveTeachingLanguages } from '../lib/api'
import { TeachingLanguages } from './TeachingLanguages'
afterEach(cleanup)
it('lets an admin edit and save the instructor teaching set', async () => {
  render(<TeachingLanguages userId="teacher-one" />)
  await waitFor(() => expect((screen.getByLabelText('Java') as HTMLInputElement).checked).toBe(true))
  fireEvent.click(screen.getByLabelText('JavaScript'))
  fireEvent.click(screen.getByRole('button', { name: 'Save teaching languages' }))
  await screen.findByText('Teaching languages saved.')
  expect(saveTeachingLanguages).toHaveBeenCalledWith('teacher-one', ['java','javascript'])
})
