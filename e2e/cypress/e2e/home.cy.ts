describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should load the home page', () => {
    cy.get('body').should('be.visible')
  })

  it('should have a title', () => {
    cy.title().should('not.be.empty')
  })
})
