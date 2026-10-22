import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorPopupManager } from './ErrorPopupManager'
import { addError, clearAllErrors } from '../lib/errorStore'

describe('ErrorPopupManager', () => {
  beforeEach(() => {
    clearAllErrors()
  })

  afterEach(() => {
    cleanup()
    clearAllErrors()
  })

  it('renders a red popup for UI errors and flips to a floating icon when closed', async () => {
    render(<ErrorPopupManager />)

    // Add a UI error
    addError({
      type: 'ui',
      title: 'Render Crash',
      message: 'Failed to mount component on client.',
    })

    // Check dialog is open with red UI error branding
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Render Crash')).toBeTruthy()
    expect(screen.getByText('Failed to mount component on client.')).toBeTruthy()
    expect(screen.getByText('UI Error')).toBeTruthy()

    // Close the popup
    fireEvent.click(screen.getByLabelText('Close error popup'))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    // Floating icon should be present with red theme and clicking reopens popup
    const floatingBtn = screen.getByRole('button', { name: /Open UI error details/i })
    expect(floatingBtn).toBeTruthy()
    expect(floatingBtn.className).toContain('bg-red-600')

    // Click floating icon to re-open
    fireEvent.click(floatingBtn)
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Render Crash')).toBeTruthy()
  })

  it('renders an orange popup for API errors', async () => {
    render(<ErrorPopupManager />)

    // Add an API error
    addError({
      type: 'api',
      title: 'No Data Available',
      message: 'The requested resource returned 404 not found.',
      status: 404,
    })

    // Verify orange API error branding
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('No Data Available')).toBeTruthy()
    expect(screen.getByText('Status 404')).toBeTruthy()
    expect(screen.getByText('API Error')).toBeTruthy()

    // Close popup
    fireEvent.click(screen.getByRole('button', { name: 'Close Popup' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    // Floating icon has orange theme
    const floatingBtn = screen.getByRole('button', { name: /Open API error details/i })
    expect(floatingBtn).toBeTruthy()
    expect(floatingBtn.className).toContain('bg-orange-500')
  })

  it('renders curriculum gaps message in the orange API error popup', async () => {
    render(<ErrorPopupManager />)

    const gapsMessage = `12 nodes with graded work available; 6 without graded work.

Full curriculum not yet completed.

Stage lessons: 12/12. Stage checks: 12/12. Module assessments: 0/6.

    Closures, this and prototypes: missing module assessment.
    Coercion: missing module assessment.`

    addError({
      type: 'api',
      title: 'Curriculum Notices & Incomplete Content',
      message: gapsMessage,
    })

    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText('Curriculum Notices & Incomplete Content')).toBeTruthy()
    expect(screen.getByText(/12 nodes with graded work available; 6 without graded work/)).toBeTruthy()
    expect(screen.getByText(/Full curriculum not yet completed/)).toBeTruthy()
    expect(screen.getByText(/Closures, this and prototypes: missing module assessment/)).toBeTruthy()
    expect(screen.getByText('API Error')).toBeTruthy()
  })

  it('closes on Escape, focuses the close button and collapses duplicate errors', async () => {
    render(<ErrorPopupManager />)
    addError({ type: 'api', message: 'down', status: 500 })
    const close = await screen.findByLabelText('Close error popup')
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    addError({ type: 'api', message: 'down', status: 500 })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Open API error details \(1 notices\)/ })).toBeTruthy()
  })
})
