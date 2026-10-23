/**
 * The header's navigation: a signed-out visitor sees Log in, a signed-in learner
 * sees the learner links and not the staff links.
 */
import { stubApi, visitAs } from '../support/e2e'

describe('header navigation', () => {
  beforeEach(() => {
    stubApi()
    cy.clearLocalStorage()
  })

  it('shows Log in to a visitor, and no staff links', () => {
    cy.visit('/')
    cy.contains('a', 'Log in').should('have.attr', 'href', '/login')
    cy.contains('a', 'Teach').should('not.exist')
    cy.contains('a', 'Admin').should('not.exist')
  })

  it('shows the learner links to a signed-in student, but not staff links', () => {
    visitAs('/')
    cy.contains('a', 'Study Room').should('have.attr', 'href', '/chat')
    cy.contains('a', 'Progress').should('have.attr', 'href', '/profile')
    cy.contains('button', 'Log out').should('be.visible')
    cy.contains('a', 'Teach').should('not.exist')
    cy.contains('a', 'Admin').should('not.exist')
  })
})
