import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { KnowledgeDocument } from '../types'

vi.mock('../lib/api', () => ({
  fetchLearnStatus: vi.fn(),
  fetchKnowledgeDocuments: vi.fn(),
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
  m.fetchLearnStatus.mockResolvedValue({ ...status, allowed_tracks: [...status.allowed_tracks] })
  m.fetchKnowledgeDocuments.mockResolvedValue([])
})

afterEach(cleanup)

describe('KnowledgeUploadPanel — teacher', () => {
  it('explains review and shows an empty list', async () => {
    render(<KnowledgeUploadPanel isAdmin={false} />)
    expect(screen.getByText(/admin reviews each upload/i)).toBeTruthy()
    expect(await screen.findByText(/no documents here yet/i)).toBeTruthy()
    expect(m.fetchKnowledgeDocuments).toHaveBeenCalledWith(undefined)
    expect(screen.getByRole('button', { name: 'Upload for review' })).toBeTruthy()
    // tracks come from /learn/status once it answers
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
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
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dsa' } })
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
    expect(screen.getAllByRole('option')).toHaveLength(4)
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
    m.fetchKnowledgeDocuments.mockResolvedValue([doc({ status: 'published', chunks: 4 })])
    m.rejectKnowledgeDocument.mockRejectedValue(new Error('store down'))
    render(<KnowledgeUploadPanel isAdmin />)
    const item = (await screen.findByText('heaps.md')).closest('li') as HTMLElement
    expect(within(item).getByText(/4 chunks/)).toBeTruthy()
    expect(within(item).queryByRole('button', { name: 'Approve' })).toBeNull()

    fireEvent.click(within(item).getByRole('button', { name: 'Unpublish' }))
    fireEvent.click(within(item).getByRole('button', { name: 'Confirm' }))
    expect((await screen.findByRole('alert')).textContent).toBe('store down')
  })

  it('shows a loading state before documents arrive', async () => {
    m.fetchKnowledgeDocuments.mockReturnValue(new Promise(() => {}))
    render(<KnowledgeUploadPanel isAdmin />)
    expect(screen.getByText(/loading documents/i)).toBeTruthy()
    await screen.findByText(/max 1 MB/) // let the status request settle
  })
})
