import { testUsers } from 'data'

const postTitle = 'New Post'
const postContent = 'HELLO! I am a post!'

describe('Make post and comments', () => {
  beforeEach(() => {
    cy.session(testUsers.fullrights.username, () => {
      cy.loginViaAPI(testUsers.fullrights.username, testUsers.fullrights.password)
    })
    cy.visit('/')
  })

  afterEach(() => {
    cy.database('delete', 'posts', { field: 'title', value: postTitle })
  })

  it('should create post and comment', () => {
    cy.get('.Topbar_newPost__X0sdL > span').click()
    cy.getBySel('create-post-title').type(postTitle)
    cy.getBySel('create-comment-textarea').click().type(postContent)
    cy.getBySel('create-comment-button-send').click()
    cy.getBySel('post-title').should('be.visible').should('have.text', postTitle)
    cy.getBySel('post-content').should('be.visible').should('have.text', postContent)
  })
})
