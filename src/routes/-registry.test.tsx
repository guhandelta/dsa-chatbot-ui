const auth = vi.hoisted(() => ({ role: 'admin' as string | null, initializing: false }))
vi.mock('../lib/auth', () => ({ hasToken: () => true, useAuth: () => ({ user: auth.role ? { role: auth.role } : null, initializing: auth.initializing }) }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingRegistryPage } from './registry'

vi.mock('../lib/api', () => ({
  fetchTrainingRegistry: vi.fn(),
}))

import { fetchTrainingRegistry } from '../lib/api'

const mockRegistryData = {
  status: 'ok',
  summary: {
    total_technologies_trained: 14,
    total_knowledge_records: 6240,
    total_retrievable_chunks: 6240,
    vector_store: {
      backend: 'chromadb',
      vector_count: 532,
      status: 'active',
      collection_name: 'dsa_problems',
    },
    last_trained_at: '2026-10-16T20:30:00Z',
    embedding_provider: 'google',
  },
  categories: {
    web_frontend: 1,
    core_languages: 6,
    backend_frameworks: 3,
    embedded_systems: 2,
    algorithms_and_dsa: 2,
  },
  technologies: [
    {
      id: 'html-css-tailwind',
      display_name: 'HTML5, CSS & Tailwind',
      category: 'web_frontend',
      total_records: 658,
      retrievable_records: 658,
      reference_library_records: 658,
      curriculum_records: 0,
      authored_catalog_records: 0,
      status: 'trained_and_available',
    },
    {
      id: 'python',
      display_name: 'Python',
      category: 'core_languages',
      total_records: 520,
      retrievable_records: 520,
      reference_library_records: 520,
      curriculum_records: 0,
      authored_catalog_records: 0,
      status: 'trained_and_available',
    },
  ],
  recent_training_events: [
    {
      id: 'tr-evt-1',
      timestamp: '2026-10-16T20:30:00Z',
      action: 'curriculum_training_and_ingest',
      technology: 'html-css-tailwind',
      category: 'web_frontend',
      source: 'Training Data/language/HTML',
      record_count: 658,
      vectors_count: 658,
      status: 'completed',
      details: {},
    },
  ],
}

describe('TrainingRegistryPage (Tech Board)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.role = 'admin'
    auth.initializing = false
    vi.mocked(fetchTrainingRegistry).mockResolvedValue(mockRegistryData)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading state initially and then shows registry metrics', async () => {
    render(<TrainingRegistryPage />)
    expect(screen.getByText(/Loading knowledge registry board.../i)).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Trained Technologies & Knowledge Board')).toBeTruthy()
      expect(screen.getByText('14')).toBeTruthy()
      expect(screen.getAllByText('6,240').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('HTML5, CSS & Tailwind')).toBeTruthy()
      expect(screen.getByText('Python')).toBeTruthy()
    })
  })

  it('allows instructors to read the registry', async () => {
    auth.role = 'instructor'
    render(<TrainingRegistryPage />)
    await waitFor(() => expect(screen.getByText('HTML5, CSS & Tailwind')).toBeTruthy())
    expect(fetchTrainingRegistry).toHaveBeenCalledTimes(1)
  })

  it.each(['student', null])('does not fetch or render registry data for %s', (role) => {
    auth.role = role
    render(<TrainingRegistryPage />)
    expect(screen.getByText('Staff access required')).toBeTruthy()
    expect(fetchTrainingRegistry).not.toHaveBeenCalled()
    expect(screen.queryByText('Trained Technologies & Knowledge Board')).toBeNull()
  })

  it('waits for session restoration before checking the role', () => {
    auth.initializing = true
    render(<TrainingRegistryPage />)
    expect(screen.getByText('Checking registry access…')).toBeTruthy()
    expect(fetchTrainingRegistry).not.toHaveBeenCalled()
  })

  it('filters technologies by category and search query', async () => {
    render(<TrainingRegistryPage />)
    await waitFor(() => {
      expect(screen.getByText('HTML5, CSS & Tailwind')).toBeTruthy()
    })

    const allButton = screen.getByRole('button', { name: /All Technologies/i })
    const webButton = screen.getByRole('button', { name: /Web & Frontend/i })

    // Verify initial active state flips text and background color
    expect(allButton.className).toContain('bg-[var(--sea-ink)]')
    expect(allButton.className).toContain('text-[var(--chip-bg)]')
    expect(webButton.className).toContain('bg-[var(--chip-bg)]')
    expect(webButton.className).toContain('text-[var(--sea-ink)]')

    // Search for Python
    const searchInput = screen.getByPlaceholderText(/Search technologies/i)
    fireEvent.change(searchInput, { target: { value: 'python' } })

    expect(screen.getByText('Python')).toBeTruthy()
    expect(screen.queryByText('HTML5, CSS & Tailwind')).toBeNull()

    // Clear search and click Web & Frontend category pill
    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(webButton)

    // Verify clicked button now has flipped colors and previous button reverted
    expect(webButton.className).toContain('bg-[var(--sea-ink)]')
    expect(webButton.className).toContain('text-[var(--chip-bg)]')
    expect(allButton.className).toContain('bg-[var(--chip-bg)]')
    expect(allButton.className).toContain('text-[var(--sea-ink)]')

    expect(screen.getByText('HTML5, CSS & Tailwind')).toBeTruthy()
    expect(screen.queryByText('Python')).toBeNull()
  })

  it('renders the recent training audit log table', async () => {
    render(<TrainingRegistryPage />)
    await waitFor(() => {
      expect(screen.getByText('Recent Training & Ingestion Audit Log')).toBeTruthy()
      expect(screen.getByText('HTML-CSS-TAILWIND')).toBeTruthy()
      expect(screen.getByText('curriculum_training_and_ingest')).toBeTruthy()
    })
  })
})
