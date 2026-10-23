/**
 * Shared Cypress support: a signed-in learner, a stubbed API, and small helpers.
 * Every spec calls `stubApi()` first so no test depends on a running backend.
 */
// Must match TOKEN_KEY in src/lib/api.ts. Importing app code here would pull in Vite-only
// APIs (import.meta.env) that Cypress's bundler does not provide.
const TOKEN_KEY = 'dsa_token'

export const API = 'http://localhost:8000'

export const learner = {
  id: 'learner-1', email: 'learner@example.com', role: 'student', peppercorns: 50,
  created_at: '2026-10-01T00:00:00Z', subscriptions: ['python'],
}

/** Stubs the calls the app makes on every page, with harmless empty answers. */
export function stubApi(): void {
  cy.intercept('GET', `${API}/**`, { statusCode: 200, body: {} }).as('anything')
  cy.intercept('GET', `${API}/auth/me`, learner).as('me')
  cy.intercept('GET', `${API}/auth/me/access`, { languages: ['python'], preferred_language: 'python' }).as('access')
  cy.intercept('GET', `${API}/study/allowance`, { daily_free: 5, used_today: 0, free_left: 5, cost_after_free: 1 }).as('allowance')
}

/**
 * Visits a page as a signed-in learner. The token is stored on a public page first, so
 * it is already present when the target page loads and the app never redirects to login.
 */
export function visitAs(path: string): void {
  cy.visit('/about')
  cy.window().then((win) => win.localStorage.setItem(TOKEN_KEY, 'test-token'))
  cy.visit(path)
}
