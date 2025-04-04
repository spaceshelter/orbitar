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
    cy.login('wrongUsername', 'wrongPassword')
    cy.get('[data-testid="sign-in-error"]').should('be.visible')
  })

  it('should login with correct credentials', () => {
    cy.login()
    cy.get('title').should('contain', 'Главная')
  })
})
