import { testUsers } from 'data'

describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should show login form', () => {
    cy.get('form').should('be.visible')
    cy.get('input[type="text"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('input[type="submit"]').should('be.visible')
  })

  it('should show disabled submit button', () => {
    cy.get('input[type="submit"]').should('be.disabled')
  })

  it('should show error on wrong credentials', () => {
    cy.get('input[type="text"]').type(testUsers.wrong.username)
    cy.get('input[type="password"]').type(testUsers.wrong.password)
    cy.get('input[type="submit"]').click()
    cy.get('[data-testid="sign-in-error"]').should('be.visible')
  })

  it('should login with correct credentials', () => {
    cy.get('input[type="text"]').type(testUsers.fullrights.username)
    cy.get('input[type="password"]').type(testUsers.fullrights.password)
    cy.get('input[type="submit"]').click()
    cy.get('title').should('contain', 'Главная')
  })
})
