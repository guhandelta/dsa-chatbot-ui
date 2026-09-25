import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">About</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Practice DSA with grounded AI feedback.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          DSA Mentor pairs a retrieval-augmented tutor with a real code editor.
          Learn mode answers your questions using a curated knowledge base of
          problems, hints, and optimal solutions. Practice mode reviews your
          submitted code against the canonical solution and returns structured
          feedback: mistakes, enhancements, edge cases, and interview tips.
          Usage is metered in peppercorns — every new account starts with 50.
        </p>
      </section>
    </main>
  )
}
