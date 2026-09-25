# DSA Mentor UI

React 19 + Vite + TanStack Router frontend for the DSA RAG chatbot.
Learn mode (RAG chat tutor), Practice mode (Monaco editor + structured
code analysis), JWT auth, and a live peppercorn balance in the header.

## Setup

```bash
cd dsa-chatbot-ui
cp .env.example .env        # VITE_API_URL defaults to http://localhost:8000
npm install
npm run dev                 # http://localhost:3000
```

Start the backend first (see ../dsa-chatbot-api/README.md), then:

1. Sign up at /register — you get 50 peppercorns.
2. Learn at /chat (1 peppercorn per message).
3. Practice at /practice (5 peppercorns per analysis) — try problem IDs
   `two-sum`, `binary-search`, or `reverse-linked-list` after seeding the
   knowledge base.

## Structure

- `src/lib/api.ts` — typed API client (env-driven base URL, JWT interceptor)
- `src/lib/auth.tsx` — AuthProvider/useAuth (session restore via /auth/me)
- `src/hooks/useChat.ts` — chat state with error handling + balance sync
- `src/routes/` — file-based routes: `/`, `/login`, `/register`, `/chat`, `/practice`, `/about`

## Practice problems

The Practice page loads its problem list from the backend `/problems`
catalog (grouped by difficulty). If the API is unreachable it degrades to a
free-text problem-ID input. Submitting code calls `/analyze/` and renders
structured feedback.

## Tests

```bash
npm install
npm test               # vitest: API error helper + useChat optimistic rollback
```

## Training & admin pages

- `/train` — teachers and admins submit problems. Any subset of the six
  languages can be filled in; the rest are written, all are executed, and the
  verification report shows exactly what passed, what was corrected, and what
  couldn't be verified.
- `/admin` — admins promote people to the teacher role.

Nav links for both appear automatically based on the signed-in user's role.

## Mentor, evidence, and progress

- **MentorPanel** sits alongside the editor on `/practice`. The learner must
  write their reasoning before a hint is produced — the mentor responds to
  their thinking, not the problem. Shows the hint tier, their recalled earlier
  reasoning, and a step-back offer at the top tier.
- **EvidencePanel** renders above the written review: curated test results,
  fuzzing counterexamples with the exact failing inputs, and measured growth.
  Facts before interpretation, so feedback is auditable.
- **`/profile`** shows behavioural patterns only — what they did, never what
  kind of person they are — plus subscriptions and export/erase controls.
