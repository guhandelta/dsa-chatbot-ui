# Editing the web curriculum

Edit `web-fundamentals.json` to change the web-fundamentals lessons, section outcomes, challenge text, challenge kinds, elective descriptions, or their order. The UI and API do not need code changes for content-only edits.

## Content rules

- Keep `schemaVersion` at `1` unless the curriculum data structure itself changes.
- Keep every section `id` unique and stable. It is used in saved project names and playground links.
- Keep every challenge `id` unique within its section and stable. It is used in links; do not derive it from the item's array position. A title or description can change without changing the ID.
- Sections, lessons, challenges, and electives render in JSON array order.
- Challenge `kind` must be one of `learn`, `build`, `debug`, or `review`.
- Keep the required text fields non-empty. Lesson objects need `title` and `focus`; challenges need `id`, `title`, `task`, and `kind`.

## Verify an edit

From `dsa-chatbot-ui`, run:

```bash
npx vitest run src/components/WebCurriculum.test.tsx src/routes/-playground.test.tsx
npx tsc --noEmit
npm run build
```

A content-only change still needs the UI to be rebuilt and redeployed/restarted for the changed data to appear. It does not require edits to component code, route logic, or the API.
