// The problem the learner is solving.
//
// This exists because without it the Practice page was unusable: an editor
// with no description, forcing the student to keep LeetCode open in another
// tab. The content was always available from /tracks/items/{id}; nothing
// rendered it.
//
// Reference SOLUTIONS are deliberately stripped before display. The markdown
// contains fully worked answers in six languages, and showing them beside
// the editor would defeat the entire exercise.
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchContentItem, getApiErrorMessage } from '../lib/api'

interface Props {
  problemId: string
}

/**
 * Trims a problem document down to what a learner should see while solving.
 *
 * Keeps: title, problem statement, examples, constraints.
 * Removes: Approach, Hints, Thinking Style, Edge Cases, Solutions.
 *
 * "Approach" is cut deliberately — it names the optimal technique and its
 * complexity, which is precisely what the exercise asks the learner to
 * derive. Leaving it visible would defeat the practice and undercut the
 * Socratic mentor, which exists to guide them there by questioning.
 *
 * Fails closed: if no recognised section heading is present (a hand-authored
 * file that ignores the convention), everything from the first fenced code
 * block onward is dropped rather than risk rendering an answer.
 */
export function stripSolutions(markdown: string): string {
  const cutPoints = [
    markdown.indexOf('\n## Approach'),
    markdown.indexOf('\n## Hints'),
    markdown.indexOf('\n## Thinking Style'),
    markdown.indexOf('\n## Edge Cases'),
    markdown.indexOf('\n## Common Mistakes'),
    markdown.indexOf('\n## Solutions'),
    markdown.indexOf('\n### Python'),
  ].filter((i) => i >= 0)

  if (cutPoints.length === 0) {
    // No recognised solution section. If the document contains fenced code
    // at all, it may be an unconventional layout holding an answer — show
    // only the text before the first fence.
    const fence = markdown.indexOf('\n```')
    return fence >= 0 ? markdown.slice(0, fence) : markdown
  }
  return markdown.slice(0, Math.min(...cutPoints))
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
    setLoading(true)
    setError(null)
    fetchContentItem(problemId)
      .then((data) => setMarkdown(stripSolutions(data.markdown)))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
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
