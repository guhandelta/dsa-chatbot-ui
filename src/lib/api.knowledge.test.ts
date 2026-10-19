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
  trainKnowledgeBaseDocument,
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
    expect(http.get).toHaveBeenCalledWith('/teach/status')
  })

  it('uploads a file as multipart form data', async () => {
    const file = new File(['# notes'], 'notes.md', { type: 'text/markdown' })
    expect(await uploadKnowledge({ file, track: 'algorithm' })).toBe('posted')
    const [path, body] = http.post.mock.calls[0]
    expect(path).toBe('/teach/train')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
    expect((body as FormData).get('track')).toBe('algorithm')
  })

  it('uploads pasted text as JSON and drops an empty filename', async () => {
    await uploadKnowledge({ text: 'heaps', filename: '', track: 'custom' })
    expect(http.post).toHaveBeenCalledWith('/teach/train', {
      text: 'heaps',
      filename: undefined,
      track: 'custom',
    })
  })

  it('sends empty text when none is given', async () => {
    await uploadKnowledge({ track: 'dsa', filename: 'x.md' })
    expect(http.post).toHaveBeenCalledWith('/teach/train', {
      text: '',
      filename: 'x.md',
      track: 'dsa',
    })
  })

  it('lists documents with and without a status filter', async () => {
    await fetchKnowledgeDocuments()
    await fetchKnowledgeDocuments('pending')
    expect(http.get).toHaveBeenNthCalledWith(1, '/teach/documents', { params: {} })
    expect(http.get).toHaveBeenNthCalledWith(2, '/teach/documents', {
      params: { status: 'pending' },
    })
  })

  it('encodes ids in document paths', async () => {
    await fetchKnowledgeDocument('a/b')
    await deleteKnowledgeDocument('a/b')
    await approveKnowledgeDocument('a/b')
    await rejectKnowledgeDocument('a/b')
    await rejectKnowledgeDocument('c', 'off-topic')
    expect(http.get).toHaveBeenCalledWith('/teach/documents/a%2Fb')
    expect(http.delete).toHaveBeenCalledWith('/teach/documents/a%2Fb')
    expect(http.post).toHaveBeenCalledWith('/teach/documents/a%2Fb/approve')
    expect(http.post).toHaveBeenCalledWith('/teach/documents/a%2Fb/reject', { note: '' })
    expect(http.post).toHaveBeenCalledWith('/teach/documents/c/reject', { note: 'off-topic' })
  })
})

it('preserves reference language in file and raw text uploads', async () => {
  http.post.mockResolvedValue({ data: {} })
  await uploadKnowledge({ file: new File(['notes'], 'notes.md'), track: 'language', language: 'python' })
  expect(http.post.mock.lastCall?.[0]).toBe('/teach/train')
  expect(http.post.mock.lastCall?.[1].get('language')).toBe('python')
  await uploadKnowledge({ text: 'notes', filename: 'notes.md', track: 'language', language: 'java' })
  expect(http.post).toHaveBeenLastCalledWith('/teach/train', { text: 'notes', filename: 'notes.md', track: 'language', language: 'java' })
})


it('keeps the legacy document helper on the canonical Teach API with source metadata', async () => {
  http.post.mockResolvedValue({ data: {} })
  await trainKnowledgeBaseDocument({ text: 'Java notes', track: 'language', language: 'java' })
  const [path, body] = http.post.mock.lastCall!
  expect(path).toBe('/teach/train')
  expect(body.get('text')).toBe('Java notes')
  expect(body.get('track')).toBe('language')
  expect(body.get('language')).toBe('java')
})
