/**
 * Unexpected API failures show a non-blocking toast in the corner, not a modal. Errors
 * the caller handles itself (silentError) must not toast at all.
 */
import { API, stubApi, visitAs } from '../support/e2e'

describe('error toasts', () => {
  beforeEach(() => {
    stubApi()
    cy.clearLocalStorage()
    cy.intercept('GET', `${API}/study/path*`, { statusCode: 200, body: { language: 'python', label: 'Python', current_id: null, completed: 0, total: 0, completed_stages: [], mastery_rule: '', readiness: { language: 'python', label: 'Python', spine_stages: 0, spine_total: 12, depth_lessons: 0, depth_total: 0, quiz_items: 0, runner: true, verdict: 'launch-ready', missing_content: [] }, levels: {}, nodes: [], available_total: 0, unavailable_total: 0, curriculum_complete: false } })
    cy.intercept('GET', `${API}/study/next*`, { kind: 'done', id: null, title: 'Done', reason: 'Finished.', node_id: null, link: null })
    cy.intercept('GET', `${API}/study/insights*`, { weak_concepts: [], responses: [] })
    cy.intercept('GET', `${API}/study/notes*`, { notes: [] })
    cy.intercept('GET', `${API}/study/progress-overview*`, { language: 'python', sections: [] })
  })

  it('shows a server failure as a toast, without blocking the page', () => {
    cy.intercept('GET', `${API}/study/evidence*`, { statusCode: 500, body: { detail: 'internal detail' } }).as('evidence')
    visitAs('/chat?mode=next&language=python')
    cy.wait('@evidence', { timeout: 20000 })
    cy.contains('Server error', { timeout: 8000 }).should('be.visible')
    cy.contains('internal detail').should('not.exist')
    cy.contains('Decide what to do next').should('be.visible')
  })
})
