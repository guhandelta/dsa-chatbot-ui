import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { KnowledgeDocument } from '../types'

vi.mock('../lib/api', () => ({
  fetchLearnStatus: vi.fn(),
  fetchTracks: vi.fn(),
  fetchKnowledgeDocuments: vi.fn(),
  fetchKnowledgeInventory: vi.fn(),
  fetchKnowledgeDocument: vi.fn(),
  uploadKnowledge: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  approveKnowledgeDocument: vi.fn(),
  rejectKnowledgeDocument: vi.fn(),
  getApiErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'mocked error'),
}))

import * as api from '../lib/api'
import { KnowledgeUploadPanel } from './KnowledgeUploadPanel'

const m = vi.mocked(api)

function doc(over: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'd1',
    owner_id: 'u1',
    owner_email: 'teach@x.com',
    filename: 'heaps.md',
    file_type: '.md',
    track: 'custom',
    status: 'pending',
    characters: 1200,
    chunks: 0,
    review_note: '',
    created_at: null,
    reviewed_at: null,
    ...over,
  }
}

const status = {
  status: 'online',
  supported_formats: ['.md', '.pdf', '.txt'],
  allowed_tracks: ['custom', 'dsa'] as const,
  max_upload_mb: 1,
  vector_store: 'chroma',
  embedding_provider: 'auto',
  requires_review: true,
}

function chooseFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.fetchTracks.mockResolvedValue({ training_languages: ["java", "python"] } as Awaited<ReturnType<typeof api.fetchTracks>>)
  m.fetchLearnStatus.mockResolvedValue({ ...status, allowed_tracks: [...status.allowed_tracks] })
  m.fetchKnowledgeDocuments.mockResolvedValue([])
  m.fetchKnowledgeInventory.mockResolvedValue({ sources: [], semantics: {}, limitations: [], generated_from: 'test' })
})

afterEach(cleanup)

describe('KnowledgeUploadPanel — teacher', () => {
  it('keeps the drop zone above pasted text and switches to file mode on drop', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Paste text' }))
    const zone = screen.getByText('Drag and drop training data here, or choose a file').closest('label')!
    const notes = screen.getByPlaceholderText(/paste markdown/i)
    expect(zone.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const file = new File(['# Training'], 'training.md', { type: 'text/markdown' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(screen.getByRole('tab', { name: 'Upload a file' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Selected: training.md')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/paste markdown/i)).toBeNull()
  })

  it('rejects multiple dropped files', () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    const zone = screen.getByText('Drag and drop training data here, or choose a file').closest('label')!
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['a'], 'a.md'), new File(['b'], 'b.md')] } })
    expect(screen.getByRole('alert').textContent).toMatch(/one document at a time/i)
    expect(m.uploadKnowledge).not.toHaveBeenCalled()
  })

  it('explains review and shows an empty list', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    expect(screen.getByText(/admin reviews each upload/i)).toBeTruthy()
    expect(await screen.findByText(/no documents here yet/i)).toBeTruthy()
    expect(m.fetchKnowledgeDocuments).toHaveBeenCalledWith(undefined)
    expect(screen.getByRole('button', { name: 'Upload for review' })).toBeTruthy()
    // tracks come from /learn/status once it answers
    await waitFor(() => expect(within(screen.getByRole('combobox', { name: 'Use in' })).getAllByRole('option')).toHaveLength(2))
  })

  it('shows packaged source inventory and keeps quality status distinct from availability', async () => {
    m.fetchKnowledgeInventory.mockResolvedValue({
      generated_from: 'current local data files',
      semantics: { published: 'Retrieval availability only; not a correctness claim.' },
      limitations: [],
      sources: [{
        source_id: 'reference_library:records.jsonl', source_type: 'packaged_file',
        path: 'data/reference_library/records.jsonl', content_sha256: 'abc123', record_count: 42,
        by_language: { javascript: 42 }, by_subject: { arrays: 42 }, provenance: 'Curated source set',
        retrieval_status: 'available', publication_review: 'not_applicable',
        executable_examples: 'not_recorded', pedagogical_review: 'not_recorded', quality_status: 'not_certified',
      }],
    })
    render(<KnowledgeUploadPanel isAdmin />)
    expect(await screen.findByText('data/reference_library/records.jsonl')).toBeTruthy()
    expect(screen.getByText(/42 records · Review not recorded/)).toBeTruthy()
    expect(screen.getByText(/Execution: Not recorded for this source/)).toBeTruthy()
  })

  it('shows bounded execution evidence without implying factual certification', async () => {
    m.fetchKnowledgeInventory.mockResolvedValue({
      generated_from: 'current local data files', semantics: {}, limitations: [],
      sources: [{
        source_id: 'authored:content-catalog', source_type: 'authored_markdown',
        path: 'data/content + data/dsa_problems', content_sha256: 'current', record_count: 20,
        by_language: { python: 20 }, by_subject: { python: 20 }, provenance: 'Authored examples',
        retrieval_status: 'available', publication_review: 'not_applicable',
        executable_examples: 'tests_passed_for_recorded_cases', pedagogical_review: 'not_recorded',
        factual_review: 'not_recorded', quality_status: 'not_certified',
        execution_evidence: { evidence_status: 'available', passed: 4, failed: 1, blocked: 2, stale: 3,
          checked_content_count: 7, fixture_case_checks: 24, last_checked_at: '2026-10-29T00:00:00Z',
          by_language: { python: { passed: 4, failed: 1, blocked: 2, stale: 3 } }, scope: 'Recorded cases only' },
      }],
    })
    render(<KnowledgeUploadPanel isAdmin />)
    expect(await screen.findByText(/Execution checks: 4 passed · 1 failed · 2 blocked · 3 outdated/)).toBeTruthy()
    expect(screen.getByText(/Factual review: not recorded · Teaching review: not recorded/)).toBeTruthy()
    expect(screen.getByText(/Outdated results are excluded from current passes/)).toBeTruthy()
    expect(screen.queryByText(/20 records · not certified/)).toBeNull()
    expect(screen.getByText(/7 distinct content items checked · 24 passing fixture cases/)).toBeTruthy()
  })

  it('shows reviewed claims and primary sources as partial evidence', async () => {
    m.fetchKnowledgeInventory.mockResolvedValue({
      generated_from: 'current local data files', semantics: {}, limitations: [],
      sources: [{
        source_id: 'reference_library:records.jsonl', source_type: 'packaged_file',
        path: 'reference_library/records.jsonl', content_sha256: 'source', record_count: 42,
        by_language: { typescript: 42 }, by_subject: { typescript: 42 }, provenance: 'Reference corpus',
        retrieval_status: 'available', publication_review: 'not_applicable', executable_examples: 'not_recorded',
        pedagogical_review: 'not_recorded', factual_review: 'partial_claim_review', quality_status: 'not_certified',
        factual_evidence: { records_with_checked_claims: 1, claims_checked: 1, stale_records: 0,
          review_method: 'Assistant comparison with cited primary documentation', reviewed_claims: [{
            record_id: 'typescript-assertions', claims: [{ claim: 'Assertions do not validate runtime data.',
              sources: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'] }],
          }] },
      }],
    })
    render(<KnowledgeUploadPanel isAdmin />)
    expect(await screen.findByText(/Partial claim checks recorded/)).toBeTruthy()
    expect(screen.getByText(/Full-record review is still pending/)).toBeTruthy()
    expect(screen.getByText('Assertions do not validate runtime data.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html' }).getAttribute('href'))
      .toBe('https://www.typescriptlang.org/docs/handbook/2/everyday-types.html')
  })

  it('requires a file before uploading', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/choose a document/i)
    expect(m.uploadKnowledge).not.toHaveBeenCalled()
  })

  it('rejects unsupported and extensionless files client-side', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    await waitFor(() => expect(m.fetchLearnStatus).toHaveBeenCalled())
    await screen.findByText(/max 1 MB/)

    chooseFile(new File(['x'], 'virus.exe'))
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/"\.exe"/)

    chooseFile(new File(['x'], 'README'))
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Unsupported file type\. Use/),
    )
    expect(m.uploadKnowledge).not.toHaveBeenCalled()
  })

  it('rejects files over the size limit', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    await screen.findByText(/max 1 MB/)
    const big = new File(['x'], 'big.pdf')
    Object.defineProperty(big, 'size', { value: 2 * 1024 * 1024 })
    chooseFile(big)
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/larger than 1 MB/)
  })

  it('uploads a file with the chosen track and refreshes the list', async () => {
    m.uploadKnowledge.mockResolvedValue({
      status: 'success', document_id: 'd1', review_status: 'pending', filename: 'n.md',
      file_type: '.md', characters_extracted: 5, chunks_trained: 0, track: 'dsa',
      message: 'Uploaded n.md. Awaiting approval.',
    })
    render(<KnowledgeUploadPanel isAdmin={false} />)
    await waitFor(() => expect(within(screen.getByRole('combobox', { name: 'Use in' })).getAllByRole('option')).toHaveLength(2))
    fireEvent.change(screen.getByRole('combobox', { name: 'Use in' }), { target: { value: 'dsa' } })
    const file = new File(['# n'], 'n.md')
    chooseFile(file)
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))

    expect((await screen.findByRole('status')).textContent).toMatch(/awaiting approval/i)
    expect(m.uploadKnowledge).toHaveBeenCalledWith({ file, track: 'dsa' })
    expect(m.fetchKnowledgeDocuments).toHaveBeenCalledTimes(2)
  })

  it('uploads pasted text and clears the form', async () => {
    m.uploadKnowledge.mockResolvedValue({
      status: 'success', document_id: 'd2', review_status: 'pending', filename: 'x.md',
      file_type: '.md', characters_extracted: 5, chunks_trained: 0, track: 'custom',
      message: 'ok',
    })
    render(<KnowledgeUploadPanel isAdmin={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Paste text' }))

    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/paste some notes/i)

    fireEvent.change(screen.getByPlaceholderText(/heaps-cheatsheet/), { target: { value: ' x.md ' } })
    const notes = screen.getByPlaceholderText(/paste markdown/i) as HTMLTextAreaElement
    fireEvent.change(notes, { target: { value: '## Heaps' } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))

    await screen.findByRole('status')
    expect(m.uploadKnowledge).toHaveBeenCalledWith({ text: '## Heaps', filename: 'x.md', track: 'custom' })
    expect(notes.value).toBe('')
  })

  it('shows API errors from an upload', async () => {
    m.uploadKnowledge.mockRejectedValue(new Error('Unknown track'))
    render(<KnowledgeUploadPanel isAdmin={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Paste text' }))
    fireEvent.change(screen.getByPlaceholderText(/paste markdown/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Unknown track')
  })

  it('falls back to defaults when status is unavailable', async () => {
    m.fetchLearnStatus.mockRejectedValue(new Error('down'))
    render(<KnowledgeUploadPanel isAdmin={false} />)
    await waitFor(() => expect(m.fetchLearnStatus).toHaveBeenCalled())
    expect(screen.getByText(/\.docx.*max 10 MB/)).toBeTruthy()
    expect(within(screen.getByRole('combobox', { name: 'Use in' })).getAllByRole('option')).toHaveLength(4)
  })

  it('reports a failure to load the list', async () => {
    m.fetchKnowledgeDocuments.mockRejectedValue(new Error('list failed'))
    render(<KnowledgeUploadPanel isAdmin={false} />)
    expect((await screen.findByRole('alert')).textContent).toBe('list failed')
  })

  it('lists own documents without review controls and filters by status', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([
      doc(),
      doc({ id: 'd2', filename: 'graphs.md', status: 'rejected', review_note: 'Off-topic' }),
    ])
    render(<KnowledgeUploadPanel isAdmin={false} />)
    expect(await screen.findByText('heaps.md')).toBeTruthy()
    expect(screen.getByText('Note: Off-topic')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(screen.queryByText(/teach@x.com/)).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Rejected' }))
    await waitFor(() => expect(m.fetchKnowledgeDocuments).toHaveBeenLastCalledWith('rejected'))
  })

  it('previews, hides, and handles preview errors', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc({ characters: 99999 })])
    m.fetchKnowledgeDocument.mockResolvedValueOnce({ ...doc({ characters: 99999 }), preview: '## Heaps\nA heap…' })
    render(<KnowledgeUploadPanel isAdmin={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }))
    const pre = await screen.findByLabelText('Preview of heaps.md')
    expect(pre.textContent).toMatch(/A heap…\n…$/) // truncated marker

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.queryByLabelText('Preview of heaps.md')).toBeNull()

    m.fetchKnowledgeDocument.mockRejectedValueOnce(new Error('gone'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect((await screen.findByRole('alert')).textContent).toBe('gone')
  })

  it('deletes only after confirmation', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc()])
    m.deleteKnowledgeDocument.mockResolvedValue()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<KnowledgeUploadPanel isAdmin={false} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(m.deleteKnowledgeDocument).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect((await screen.findByRole('status')).textContent).toBe('Deleted "heaps.md".')
    expect(m.deleteKnowledgeDocument).toHaveBeenCalledWith('d1')
    confirm.mockRestore()
  })
})

describe('KnowledgeUploadPanel — admin', () => {
  it('opens on the review queue with owner emails', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc()])
    render(<KnowledgeUploadPanel isAdmin />)
    expect(await screen.findByText(/teach@x.com/)).toBeTruthy()
    expect(m.fetchKnowledgeDocuments).toHaveBeenCalledWith('pending')
    expect(screen.getByText(/publish immediately/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload & publish' })).toBeTruthy()
  })

  it('approves a pending document and closes its open preview', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc()])
    m.fetchKnowledgeDocument.mockResolvedValue({ ...doc(), preview: 'text' })
    m.approveKnowledgeDocument.mockResolvedValue(doc({ status: 'published' }))
    render(<KnowledgeUploadPanel isAdmin />)
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }))
    await screen.findByLabelText('Preview of heaps.md')

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect((await screen.findByRole('status')).textContent).toBe('Published "heaps.md".')
    expect(m.approveKnowledgeDocument).toHaveBeenCalledWith('d1')
    expect(screen.queryByLabelText('Preview of heaps.md')).toBeNull()
  })

  it('rejects with a trimmed note, or cancels', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc()])
    m.rejectKnowledgeDocument.mockResolvedValue(doc({ status: 'rejected' }))
    render(<KnowledgeUploadPanel isAdmin />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.change(screen.getByPlaceholderText(/off-topic/i), { target: { value: ' dup ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect((await screen.findByRole('status')).textContent).toBe('Document rejected.')
    expect(m.rejectKnowledgeDocument).toHaveBeenCalledWith('d1', 'dup')
  })

  it('offers Unpublish for published docs and surfaces action errors', async () => {
    m.fetchKnowledgeDocuments.mockResolvedValue([doc({ status: 'published', chunks: 4,
      reference_language: 'all_languages', retrieval_status: 'available',
      content_sha256: '0123456789abcdef0123456789abcdef', projection_version: 'upload-reference-v2',
      publication_review: 'approved', executable_verification: 'not_recorded',
      pedagogical_review: 'not_recorded', created_at: '2026-10-27T10:00:00Z',
    })])
    m.rejectKnowledgeDocument.mockRejectedValue(new Error('store down'))
    render(<KnowledgeUploadPanel isAdmin />)
    const item = (await screen.findByText('heaps.md')).closest('li') as HTMLElement
    expect(within(item).getByText(/4 chunks/)).toBeTruthy()
    expect(within(item).getByText('Available for retrieval')).toBeTruthy()
    expect(within(item).getByText(/Language: Language-neutral \/ all languages/)).toBeTruthy()
    expect(within(item).getByText(/Execution evidence: not recorded/)).toBeTruthy()
    expect(within(item).getByText(/Teaching review: not recorded/)).toBeTruthy()
    expect(within(item).getByText(/Extracted-text SHA-256: 0123456789abcdef/)).toBeTruthy()
    expect(within(item).queryByRole('button', { name: 'Approve' })).toBeNull()

    fireEvent.click(within(item).getByRole('button', { name: 'Unpublish' }))
    fireEvent.click(within(item).getByRole('button', { name: 'Confirm' }))
    expect((await screen.findByRole('alert')).textContent).toBe('store down')
  })

  it('explains that publication is separate from content verification', async () => {
    render(<KnowledgeUploadPanel isAdmin />)
    expect(await screen.findByText(/Published means available to retrieval/)).toBeTruthy()
    expect(screen.getByText(/does not mean examples ran successfully/)).toBeTruthy()
  })

  it('shows a loading state before documents arrive', async () => {
    m.fetchKnowledgeDocuments.mockReturnValue(new Promise(() => {}))
    render(<KnowledgeUploadPanel isAdmin />)
    expect(screen.getByText(/loading documents/i)).toBeTruthy()
    await screen.findByText(/max 1 MB/) // let the status request settle
  })
})

it.each(['file', 'text'] as const)('sends the source language with %s uploads', async mode => {
  m.uploadKnowledge.mockResolvedValue({ message: 'Saved' } as Awaited<ReturnType<typeof api.uploadKnowledge>>)
  render(<KnowledgeUploadPanel isAdmin={false} />)
  await screen.findByRole('option', { name: 'Python' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Reference language' }), { target: { value: 'python' } })
  if (mode === 'file') chooseFile(new File(['notes'], 'notes.md'))
  else {
    fireEvent.click(screen.getByRole('tab', { name: 'Paste text' }))
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Python notes' } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Upload for review' }))
  await screen.findByText('Saved')
  expect(m.uploadKnowledge).toHaveBeenCalledWith(expect.objectContaining({ language: 'python', track: 'custom' }))
})

it('prefers the complete training language list from Teach status', async () => {
  m.fetchLearnStatus.mockResolvedValue({ ...status, allowed_tracks: [...status.allowed_tracks], training_languages: ['rust', 'typescript'] } as Awaited<ReturnType<typeof api.fetchLearnStatus>>)
  render(<KnowledgeUploadPanel isAdmin />)
  await screen.findByRole('option', { name: 'TypeScript' })
  expect(screen.getByRole('option', { name: 'Rust' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Python' })).toBeNull()
})
