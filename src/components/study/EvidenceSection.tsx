import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../lib/api'
import { fetchEvidence, type EvidenceItem } from '../../lib/studyApi'

type Props = { language: string }

// The learner's own passing code, one entry per concept. Code is shown as text, never as HTML.
export function EvidenceSection({ language }: Props) {
  const [items, setItems] = useState<EvidenceItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setItems(null); setError(null)
    fetchEvidence(language)
      .then((found) => { if (active) setItems(found) })
      .catch((err) => { if (active) setError(getApiErrorMessage(err)) })
    return () => { active = false }
  }, [language])
  return <section className="island-shell rounded-2xl p-4" aria-label="Your code evidence">
    <p className="island-kicker mb-1">Your evidence</p>
    <h2 className="m-0 text-lg font-bold">Concepts you have shown in your own code</h2>
    {error && <p className="error-banner mt-2" role="alert">{error}</p>}
    {!error && items === null && <p className="mt-2 text-sm" role="status">Loading your code…</p>}
    {!error && items && items.length === 0 && (
      <p className="mt-2 text-sm">Nothing yet. Pass a code check and the code you wrote will appear here, so you can see what you can already do.</p>
    )}
    {!error && items && items.length > 0 && (
      <ul className="mt-2 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item.item_id}>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">{item.concept} <span className="font-normal">({item.item_type === 'fix_bug' ? 'repaired' : 'written'})</span></summary>
              <pre className="mt-2 overflow-x-auto rounded-lg p-3 text-xs" aria-label={`Your code for ${item.concept}`}>{item.code}</pre>
            </details>
          </li>
        ))}
      </ul>
    )}
  </section>
}
