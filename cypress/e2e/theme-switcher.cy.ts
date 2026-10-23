/**
 * The theme switcher lives in the header on every page. These tests check that it
 * offers Auto and the four palettes, applies and remembers a choice, and returns to Auto.
 */
import { stubApi, visitAs } from '../support/e2e'

describe('theme switcher', () => {
  beforeEach(() => {
    stubApi()
    cy.clearLocalStorage()
  })

  it('offers Auto and the four palettes with names on hover', () => {
    visitAs('/')
    cy.get('[role="group"][aria-labelledby]').within(() => {
      cy.get('button').should('have.length', 5)
      cy.get('button').eq(0).should('have.attr', 'title', 'Auto')
      cy.get('button').eq(1).should('have.attr', 'title', 'Calm')
      cy.get('button').eq(4).should('have.attr', 'title', 'Warm')
    })
  })

  it('applies a palette, remembers it across a reload, and returns to Auto', () => {
    visitAs('/')
    cy.get('button[title="Focus"]').click()
    cy.get('button[title="Focus"]').should('have.attr', 'aria-pressed', 'true')
    cy.get('html').should('have.attr', 'data-palette', 'focus')
    cy.get('html').should('have.attr', 'data-theme', 'dark')
    cy.window().its('localStorage').invoke('getItem', 'theme').should('eq', 'focus')

    cy.reload()
    cy.get('html').should('have.attr', 'data-palette', 'focus')

    cy.get('button[title="Auto"]').click()
    cy.get('html').should('not.have.attr', 'data-palette')
    cy.get('button[title="Auto"]').should('have.attr', 'aria-pressed', 'true')
  })

  it('keeps the palette on other pages without a reload', () => {
    visitAs('/')
    cy.get('button[title="Warm"]').click()
    cy.get('a[href="/profile"]').first().click()
    cy.location('pathname').should('eq', '/profile')
    cy.get('html').should('have.attr', 'data-palette', 'warm')
  })
})
