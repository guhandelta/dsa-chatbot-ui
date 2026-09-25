#!/usr/bin/env bash
#
# Builds a logical commit series for the frontend.
#
# These commits reconstruct the project in a sensible build order — they are
# not a replay of real development history.
#
# Usage (from inside dsa-chatbot-ui/):
#     bash git_commits.sh
set -euo pipefail

BRANCH="${BRANCH:-main}"

if [ ! -f "src/main.tsx" ]; then
  echo "ERROR: run this from inside dsa-chatbot-ui/" >&2
  exit 1
fi

if [ ! -d .git ]; then
  echo "→ Initialising a new repository"
  git init -q
  git symbolic-ref HEAD "refs/heads/$BRANCH"
fi

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "ERROR: .env is tracked by git. Run: git rm --cached .env" >&2
  exit 1
fi

commit () {
  local msg="$1"; shift
  git add -A -- "$@" 2>/dev/null || true
  if git diff --cached --quiet; then
    echo "   (nothing staged, skipping) $msg"
  else
    git commit -q -m "$msg"
    echo "✓ $msg"
  fi
}

echo
echo "Building commit series on branch '$BRANCH'..."
echo

commit "chore: Vite, TypeScript, Tailwind, and Vitest configuration" \
  .gitignore .env.example package.json package-lock.json tsconfig.json \
  vite.config.ts vitest.config.ts index.html .cta.json .vscode

commit "chore: static assets and manifest" \
  public

commit "feat(types): shared domain types for users, tracks, and content" \
  src/types/index.ts

commit "feat(api): typed client with JWT interceptor and error normalisation" \
  src/lib/api.ts

commit "feat(auth): auth context with session restore and role awareness" \
  src/lib/auth.tsx

commit "feat(auth): login and registration pages" \
  src/routes/login.tsx src/routes/register.tsx

commit "feat(chat): chat hook with optimistic updates and rollback on failure" \
  src/hooks/useChat.ts

commit "feat(chat): chat window, message bubbles, and selectors" \
  src/components/ChatWindow.tsx src/components/MessageBubble.tsx \
  src/components/ProviderSelector.tsx src/components/LanguageSelector.tsx

commit "feat(practice): Monaco editor page with structured analysis panel" \
  src/routes/practice.tsx src/components/AnalysisPanel.tsx \
  src/components/ProblemPicker.tsx

commit "feat(tracks): learning hub and per-track learn/practice views" \
  src/routes/learn.tsx src/routes/track src/routes/chat

commit "feat(training): submission page with verification report" \
  src/routes/train.tsx src/components/ValidationReportView.tsx

commit "feat(admin): role management page" \
  src/routes/admin.tsx

commit "feat(layout): role-aware header, footer, theme toggle, and balance badge" \
  src/components/Header.tsx src/components/Footer.tsx \
  src/components/ThemeToggle.tsx src/components/PeppercornBadge.tsx \
  src/routes/__root.tsx src/main.tsx

commit "feat(pages): landing and about pages" \
  src/routes/index.tsx src/routes/about.tsx

commit "style: application stylesheet and design tokens" \
  src/styles.css

commit "test: API error handling and chat rollback coverage" \
  src/lib/api.test.ts src/hooks/useChat.test.ts

commit "docs: setup and feature documentation" \
  README.md git_commits.sh

echo
echo "Done. Review with:  git log --oneline"
echo
echo "Then push:"
echo "  git remote add origin git@github.com:<you>/dsa-chatbot-ui.git"
echo "  git push -u origin $BRANCH"
