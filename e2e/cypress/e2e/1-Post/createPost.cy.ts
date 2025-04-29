import { testUsers } from 'data'

const postTitle = 'New Post'
const postContent = 'HELLO! I am a post!'
const longPostTitle = 'Long Post'
const longPostContent = Array(100).fill('Long post content').join('\n')

describe('Create post', () => {
  beforeEach(() => {
    cy.session(testUsers.fullrights.username, () => {
      cy.loginViaAPI(testUsers.fullrights.username, testUsers.fullrights.password)
    })
    cy.visit('/')
  })

  after(() => {
    cy.database('delete', 'posts', { field: 'title', value: postTitle })
    cy.database('delete', 'posts', { field: 'title', value: longPostTitle })
  })

  it('should create post and comment', () => {
    cy.getBySel('create-post-button').click()
    cy.getBySel('create-post-title').type(postTitle)
    cy.getBySel('create-comment-textarea').click().type(postContent)
    cy.getBySel('create-comment-button-send').click()
    cy.getBySel('post-title').should('be.visible').should('have.text', postTitle)
    cy.getBySel('post-content').should('be.visible').should('have.text', postContent)
  })

  it('should create long post', () => {
    cy.getBySel('create-post-button').click()
    cy.getBySel('create-post-title').type(longPostTitle)
    cy.getBySel('create-comment-textarea').reactType(longPostContent)
    cy.getBySel('create-comment-button-send').click()
    cy.getBySel('post-title').should('be.visible').should('have.text', longPostTitle)
    cy.getBySel('post-content').should('be.visible').should('have.text', longPostContent)
  })

  it('should list created posts', () => {
    cy.getBySel('post').should('have.length', 2)

    cy.getBySel('post')
      .contains(longPostTitle)
      .parents('[data-testid="post"]')
      .should('exist')
      .within(() => {
        cy.getBySel('post-title').should('be.visible').should('have.text', longPostTitle)
        cy.getBySel('username').should('be.visible').should('have.text', testUsers.fullrights.username)
        cy.getBySel('post-content')
          .should('be.visible')
          .should('contain', longPostContent)
          .contains('button', 'Читать дальше')
          .should('exist')
      })

    cy.getBySel('post')
      .contains(postTitle)
      .parents('[data-testid="post"]')
      .should('exist')
      .within(() => {
        cy.getBySel('post-title').should('be.visible').should('have.text', postTitle)
        cy.getBySel('username').should('be.visible').should('have.text', testUsers.fullrights.username)
        cy.getBySel('post-content')
          .should('be.visible')
          .should('have.text', postContent)
          .contains('button', 'Читать дальше')
          .should('not.exist')
      })
  })
})
