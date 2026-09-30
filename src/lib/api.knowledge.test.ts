// Knowledge-base client functions: correct verbs, paths, params and bodies.
// axios.create is swapped for a stub instance so nothing hits the network.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
}))

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: () => http } }
})

import {
  approveKnowledgeDocument,
  deleteKnowledgeDocument,
  fetchKnowledgeDocument,
  fetchKnowledgeDocuments,
  fetchLearnStatus,
  rejectKnowledgeDocument,
  uploadKnowledge,
} from './api'

describe('knowledge base api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    http.get.mockResolvedValue({ data: 'got' })
    http.post.mockResolvedValue({ data: 'posted' })
    http.delete.mockResolvedValue({ data: null })
  })

  it('fetches the pipeline status', async () => {
    expect(await fetchLearnStatus()).toBe('got')
    expect(http.get).toHaveBeenCalledWith('/learn/status')
  })

  it('uploads a file as multipart form data', async () => {
    const file = new File(['# notes'], 'notes.md', { type: 'text/markdown' })
    expect(await uploadKnowledge({ file, track: 'algorithm' })).toBe('posted')
    const [path, body] = http.post.mock.calls[0]
    expect(path).toBe('/learn/train')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect((body as FormData).get('track')).toBe('algorithm')
  })

  it('uploads pasted text as JSON and drops an empty filename', async () => {
    await uploadKnowledge({ text: 'heaps', filename: '', track: 'custom' })
    expect(http.post).toHaveBeenCalledWith('/learn/train', {
      text: 'heaps',
      filename: undefined,
      track: 'custom',
    })
  })

  it('sends empty text when none is given', async () => {
    await uploadKnowledge({ track: 'dsa', filename: 'x.md' })
    expect(http.post).toHaveBeenCalledWith('/learn/train', {
      text: '',
      filename: 'x.md',
      track: 'dsa',
    })
  })

  it('lists documents with and without a status filter', async () => {
    await fetchKnowledgeDocuments()
    await fetchKnowledgeDocuments('pending')
    expect(http.get).toHaveBeenNthCalledWith(1, '/learn/documents', { params: {} })
    expect(http.get).toHaveBeenNthCalledWith(2, '/learn/documents', {
      params: { status: 'pending' },
    })
  })

  it('encodes ids in document paths', async () => {
    await fetchKnowledgeDocument('a/b')
    await deleteKnowledgeDocument('a/b')
    await approveKnowledgeDocument('a/b')
    await rejectKnowledgeDocument('a/b')
    await rejectKnowledgeDocument('c', 'off-topic')
    expect(http.get).toHaveBeenCalledWith('/learn/documents/a%2Fb')
    expect(http.delete).toHaveBeenCalledWith('/learn/documents/a%2Fb')
    expect(http.post).toHaveBeenCalledWith('/learn/documents/a%2Fb/approve')
    expect(http.post).toHaveBeenCalledWith('/learn/documents/a%2Fb/reject', { note: '' })
    expect(http.post).toHaveBeenCalledWith('/learn/documents/c/reject', { note: 'off-topic' })
  })
})
