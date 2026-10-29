# Learning support

The shared support bar appears for signed-in learners on Learn, Study Room,
track lessons, coding practice and the UI playground. It stays visible while
scrolling, including practice focus mode. Other routes retain their existing UI.

## Learning steps and feedback

The milestones are **Review an example**, **Make an attempt**, **Review feedback**
and **Try a variation**. They are explicitly self-recorded learning steps, separate
from server-graded completion, scores and rewards. Foundation stage lessons, quizzes
and their coding exercises share a topic key. Failed attempts never erase steps.

Coding test results and quiz grading automatically record an attempt. Infrastructure
errors and unavailable runtimes do not count as learner failures. Three unsuccessful
checks on the same topic offer a different approach; a successful check clears that
offer. Explicit UI playground runs record an attempt, and TypeScript compiler
diagnostics can trigger the offer. Loading a saved project or auto-refreshing does
not count as a new learner attempt. Rendering a UI preview is not proof of correctness.

“I’m stuck” is always available in the bar. It offers tracing a smaller example,
breaking the task into a single operation, reviewing a prerequisite, and editing
the next step. Nothing automatically blocks the editor, spends credits or calls
an AI provider.

## Pause and return

Pause flushes registered draft savers before recording success. Practice and
playground use the existing server autosave with an additional checked flush;
offline, failed and conflicted saves cannot show a successful pause. A quiz or
tutor request still in progress must finish before a pause can succeed.

Learning steps, the next step, unsent tutor/debug drafts and practice reflections, selected course reading,
and the current quiz session/answer are stored in browser localStorage under an
account-and-topic-specific key. Reloading a completed quiz does not submit answers
again or replay rewards. The latest paused route is offered as a continuation link
on other learning pages. Track lesson links include the selected topic.

These browser records are device-specific. Clearing browser data removes them;
using another browser or device does not transfer them. Editor code continues to
use the existing server draft storage. This feature does not restore tutor chat
transcripts, and does not extend or renew expired server quiz sessions. Accounts
must still have access to a saved task when returning to it.

Storage errors are visible and keep the page usable. Corrupt records are ignored,
counters and next-step length are bounded, resume links are restricted to local
learning routes, and milestone updates preserve steps already saved in another tab.

## Verification

Tests cover pause/reload/resume, save rejection and retry, in-flight writes,
account/topic changes, late saves, malformed records, repeated outcomes, quiz
restoration and reward non-replay, and continuation-link safety. The stress test
executes 1,000 success/failure interactions and verifies bounded, monotonic progress.
