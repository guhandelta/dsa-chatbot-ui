# Editing the web curriculum

Edit `web-fundamentals.json` to change the web-fundamentals lessons, section outcomes, challenge text, challenge kinds, elective descriptions, or their order. The UI and API do not need code changes for content-only edits.

## Content rules

- Keep `schemaVersion` at `1` unless the curriculum data structure itself changes.
- Keep every section `id` unique and stable. It is used in saved project names and playground links.
- Keep every challenge `id` unique within its section and stable. It is used in links; do not derive it from the item's array position. A title or description can change without changing the ID.
- Sections, lessons, challenges, and electives render in JSON array order.
- Challenge `kind` must be one of `learn`, `build`, `debug`, or `review`.
- Keep the required text fields non-empty. Lesson objects need `title` and `focus`; challenges need `id`, `title`, `task`, and `kind`.
- Challenges may include `starterFiles` with unique file names, non-empty content, and an `index.html`. New challenge projects use those files; saved projects keep the learner's draft. Challenges without `starterFiles` use the regular playground template.
- Starter files are practice scaffolds, not answer keys or grading tests. Add them only when they give the learner a useful place to begin.

## Verify an edit

From `dsa-chatbot-ui`, run:

```bash
npx vitest run src/components/WebCurriculum.test.tsx src/routes/-playground.test.tsx
npx tsc --noEmit
npm run build
```

A content-only change still needs the UI to be rebuilt and redeployed/restarted for the changed data to appear. It does not require edits to component code, route logic, or the API.
