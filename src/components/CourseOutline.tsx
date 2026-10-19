import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchCourse, fetchCourseReading, type Course, type CourseReading } from '../lib/courseApi'
import { getApiErrorMessage } from '../lib/api'

export function CourseOutline({ language }: { language: string }) {
  const [course, setCourse] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<CourseReading | null>(null)
  const [readingError, setReadingError] = useState<string | null>(null)
  const [loadingReading, setLoadingReading] = useState(false)
  const request = useRef(0)
  const readingPanel = useRef<HTMLElement>(null)
  useEffect(() => { if (reading) readingPanel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }, [reading])
  useEffect(() => {
    let active = true
    ++request.current
    setCourse(null); setError(null); setReading(null); setReadingError(null); setLoadingReading(false)
    fetchCourse(language).then((value) => { if (active) setCourse(value) })
      .catch((e) => { if (active) setError(getApiErrorMessage(e)) })
    return () => { active = false; ++request.current }
  }, [language])
  const read = async (moduleId: string, sourceId: string) => {
    const version = ++request.current
    setLoadingReading(true); setReadingError(null); setReading(null)
    try {
      const value = await fetchCourseReading(language, moduleId, sourceId)
      if (version === request.current) setReading(value)
    } catch (e) { if (version === request.current) setReadingError(getApiErrorMessage(e)) }
    finally { if (version === request.current) setLoadingReading(false) }
  }
  return <section className="island-shell rounded-2xl p-5" aria-label="Language course">
    {error && <p className="error-banner" role="alert">Course could not be loaded: {error}</p>}
    {!course && !error && <p role="status">Loading course outline…</p>}
    {course && <>
      <p className="island-kicker mb-1">Course outline · draft</p>
      <h2 className="mb-2 text-xl font-bold">{course.title}</h2>
      <p className="mb-3 text-sm">{course.description}</p>
      <p className="mb-3 text-sm">Readings are available from the existing knowledge base. Practice briefs are self-guided; they are not automatically graded exercises. Full lesson and assessment authoring remains in progress.</p>
      <p className="mb-3 text-sm"><strong>Before you start:</strong> {course.prerequisites.join(' ')}</p>
      <ol className="space-y-3 pl-5">{course.modules.map((module, index) => <li key={module.id}>
        <details className="rounded-xl border border-[var(--line)] p-3">
          <summary className="cursor-pointer font-semibold">{index + 1}. {module.title}</summary>
          <p className="mt-3 mb-1 text-sm font-semibold">What you will learn</p>
          <ul className="list-disc pl-5 text-sm">{module.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
          <p className="mt-3 mb-1 text-sm font-semibold">Practise what you learned</p>
          <p className="text-sm">{module.practice_brief}</p>
          <p className="mt-3 mb-1 text-sm font-semibold">Readings from your library</p>
          {module.source_status === 'partial' && <p className="text-sm">Some assigned readings are currently unavailable.</p>}
          {module.sources.length === 0 && <p className="text-sm">A suitable reading still needs to be authored or mapped for this module.</p>}
          <div className="flex flex-wrap gap-2">{module.sources.map((source) => <button key={source.id} type="button" className="mini-btn" onClick={() => void read(module.id, source.id)}>Read: {source.title}</button>)}</div>
        </details>
      </li>)}</ol>
      <section className="mt-4">
        <h3 className="text-lg font-semibold">Capstone: {course.capstone.title}</h3>
        <p className="my-2 text-sm">{course.capstone.brief}</p>
        <ul className="list-disc pl-5 text-sm">{course.capstone.deliverables.map((task) => <li key={task}>{task}</li>)}</ul>
      </section>
      {course.limitations.length > 0 && <details className="mt-4"><summary>What still needs review or authoring</summary><ul className="list-disc pl-5 text-sm">{course.limitations.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}
    </>}
    {loadingReading && <p role="status" className="mt-4">Loading reading…</p>}
    {readingError && <p role="alert" className="error-banner mt-4">{readingError}</p>}
    {reading && <article ref={readingPanel} className="mt-5 rounded-xl border border-[var(--line)] p-4" aria-label="Course reading">
      <h3 className="mb-3 text-lg font-bold">{reading.title}</h3>
      <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{reading.document}</ReactMarkdown></div>
      <button type="button" className="mini-btn mt-3" onClick={() => setReading(null)}>Close reading</button>
    </article>}
  </section>
}
