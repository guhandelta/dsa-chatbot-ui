// Open chat: the free-form tutor with optional reference collections and the
// private agentic-retrieval pilot. Kept alongside the Study Room modes.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChatCapabilities, fetchReferenceSubjects } from '../../lib/api'
import { ChatWindow } from '../ChatWindow'
import type { ChatProvider } from '../../types'

interface Props {
  language: string
  languages: string[]
  provider: ChatProvider
  userId?: string
}

export function OpenChat({ language, languages, provider, userId }: Props) {
  const defaultTrack = ['javascript', 'java'].includes(language) ? 'dsa' : 'language'
  const [subjectId, setSubjectId] = useState('')
  const [agentic, setAgentic] = useState(false)
  const capabilities = useQuery({ queryKey: ['chat-capabilities', userId], queryFn: fetchChatCapabilities })
  const pilotAvailable = capabilities.data?.agentic_retrieval && !capabilities.isError
  const retrievalMode = pilotAvailable && agentic ? 'agentic' : 'standard'
  const library = useQuery({ queryKey: ['reference-subjects', userId], queryFn: fetchReferenceSubjects })
  const references = library.isError ? [] : (library.data ?? []).filter(
    (item) => item.language === language && item.retrievable_records > 0 && languages.includes(item.language))
  const subject = references.find((item) => item.id === subjectId)
  return <>
    {references.length > 0 && <section className="mb-4 rounded-xl border border-[var(--line)] p-4">
      <label className="block text-sm font-semibold" htmlFor="reference-subject">Learning material (optional)</label>
      <select id="reference-subject" value={subject?.id ?? ''} onChange={(event) => setSubjectId(event.target.value)} className="mt-2 rounded-lg border p-2">
        <option value="">General tutor</option>
        {references.map((item) => (
          <option key={item.id} value={item.id}>{item.id.replaceAll('-', ' ')} ({item.retrievable_records} references)</option>
        ))}
      </select>
      {subject && <p className="mt-2 text-sm">Reference learning in {subject.language}. This material is not a verified workout; framework and hardware examples need their own execution checks.</p>}
      <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">Focus answers on a specific reference collection in your selected language, or use the general tutor. Changing the language or collection starts a new conversation.</p>
    </section>}
    {library.isError && <p className="mb-4 text-sm" role="status">Optional learning material couldn’t be loaded. The general tutor is still available.</p>}
    {pilotAvailable && (
      <label className="mb-4 block text-sm">
        <input type="checkbox" checked={agentic} onChange={(e) => setAgentic(e.target.checked)} />{' '}
        Try experimental retrieval
        <span className="ml-2">May take longer; references and answers still need review.</span>
      </label>
    )}
    <ChatWindow retrievalMode={retrievalMode} key={`${subject?.id ?? `dsa:${language}`}:${retrievalMode}`} provider={provider}
      language={language} track={subject ? 'language' : defaultTrack} subject={subject?.id} chatCost={1} />
  </>
}
