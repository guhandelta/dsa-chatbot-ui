/**
 * Shared test setup, loaded before every test file (see vitest.config.ts).
 *
 * The Study Room renders several components that each wait on mocked requests.
 * Under coverage instrumentation and a full parallel run, a render can take longer
 * than React Testing Library's default 1 second wait for `findBy*` and `waitFor`.
 * The tests are not wrong, only slow, so every async query gets a 5 second budget.
 * That still fails fast on a real hang.
 */
import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })
