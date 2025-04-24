import { testUsers } from 'data'

describe('template spec', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('passes', () => {
    cy.login(testUsers.fullrights.username, testUsers.fullrights.password)
    cy.get('.Topbar_newPost__X0sdL > span').click()
    cy.get('[data-testid="create-post-title"]').type('New Post')
    cy.get('[data-testid="create-comment-textarea"]').click()
    cy.get('[data-testid="create-comment-textarea"]').type('HELLO! I am a post!')
    cy.get('[data-testid="create-comment-button-send"]').click()
    cy.get('[data-testid="post-title"]').should('be.visible')
    cy.get('[data-testid="post-title"]').should('have.text', 'New Post')
    cy.get('[data-testid="post-content"]').should('be.visible')
    cy.get('[data-testid="post-content"]').should('have.text', 'HELLO! I am a post!')

    cy.database('select', 'posts', { field: 'post_id', value: 1 }).then((rows) => {
      cy.log(rows)
    })
  })
})
