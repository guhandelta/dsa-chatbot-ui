// The problem the learner is solving.
//
// This exists because without it the Practice page was unusable: an editor
// with no description, forcing the student to keep LeetCode open in another
// tab. The content was always available from /tracks/items/{id}; nothing
// rendered it.
//
// The API supplies a learner-safe view; hidden tests and solutions never
// reach this component. Keep worked examples and starter code visible.
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchContentItem, getApiErrorMessage } from '../lib/api'

interface Props {
  problemId: string
}

export function ProblemStatement({ problemId }: Props) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!problemId) {
      setMarkdown(null)
      return
    }
    let active = true
    setMarkdown(null)
    setLoading(true)
    setError(null)
    fetchContentItem(problemId)
      .then((data) => { if (active) setMarkdown(data.markdown) })
      .catch((err) => { if (active) setError(getApiErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [problemId])

  if (!problemId) {
    return (
      <section className="island-shell rounded-2xl p-5">
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          Choose a problem to see the statement here.
        </p>
      </section>
    )
  }

  return (
    <section className="island-shell statement-panel rounded-2xl p-5">
      {loading && (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">Loading problem…</p>
      )}
      {error && <div className="error-banner">{error}</div>}
      {markdown && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </section>
  )
}
