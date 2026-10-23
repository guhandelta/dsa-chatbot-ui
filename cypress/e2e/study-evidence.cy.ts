/**
 * The progress view's "Your evidence" section. Learner code must show as text,
 * the empty state must explain itself, and a failed request must show an alert.
 */
import { API, stubApi, visitAs } from '../support/e2e'

const evidence = {
  language: 'python',
  items: [{
    concept: 'floor-division', item_id: 'py-s01-fix', item_type: 'fix_bug',
    code: 'def average_minutes(total, days):\n    return total // days', passed_at: '2026-10-23T00:00:00Z',
  }],
}

// The Study Room's next-step view needs a path and a next step before it renders the
// evidence section, so these stubs supply the smallest valid versions of both.
const path = {
  language: 'python', label: 'Python', current_id: null, completed: 0, total: 0, completed_stages: [],
  mastery_rule: 'Pass the graded exercise and score at least 2 of 3 on the checks.',
  readiness: { language: 'python', label: 'Python', spine_stages: 0, spine_total: 12, depth_lessons: 0, depth_total: 0, quiz_items: 0, runner: true, verdict: 'launch-ready', missing_content: [] },
  levels: {}, nodes: [], available_total: 0, unavailable_total: 0, curriculum_complete: false,
}
const nextStep = { kind: 'done', id: null, title: 'All available work done', reason: 'You have finished the available work.', node_id: null, link: null }

describe('study evidence', () => {
  beforeEach(() => {
    stubApi()
    cy.clearLocalStorage()
    cy.intercept('GET', `${API}/study/path*`, path).as('path')
    cy.intercept('GET', `${API}/study/next*`, nextStep).as('next')
    cy.intercept('GET', `${API}/study/insights*`, { weak_concepts: [], responses: [] }).as('insights')
    cy.intercept('GET', `${API}/study/notes*`, { notes: [] }).as('notes')
    cy.intercept('GET', `${API}/study/progress-overview*`, { language: 'python', sections: [] }).as('overview')
  })

  it('lists the learner’s own passing code and shows it as text', () => {
    cy.intercept('GET', `${API}/study/evidence*`, evidence).as('evidence')
    visitAs('/chat?mode=next&language=python')
    cy.contains('Decide what to do next', { timeout: 20000 }).should('be.visible')
    cy.wait('@evidence', { timeout: 20000 })
    cy.contains('floor-division').should('be.visible')
    cy.get('[aria-label="Your code for floor-division"]').should('contain.text', 'total // days')
  })

  it('explains the empty state when no code has passed yet', () => {
    cy.intercept('GET', `${API}/study/evidence*`, { language: 'python', items: [] }).as('evidence')
    visitAs('/chat?mode=next&language=python')
    cy.wait('@evidence', { timeout: 20000 })
    cy.contains('Nothing yet').should('be.visible')
  })

  it('shows an alert when the evidence request fails', () => {
    cy.intercept('GET', `${API}/study/evidence*`, { statusCode: 500, body: { detail: 'boom' } }).as('evidence')
    visitAs('/chat?mode=next&language=python')
    cy.wait('@evidence', { timeout: 20000 })
    cy.get('[role="alert"]').should('contain.text', 'The server ran into a problem')
  })
})
