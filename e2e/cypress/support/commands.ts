/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })

// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })

// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })

// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add(
  'login',
  (username: string = Cypress.env('username'), password: string = Cypress.env('password')) => {
    cy.visit('/')
    cy.get('input[type="text"]').type(username)
    cy.get('input[type="password"]').type(password)
    cy.get('input[type="submit"]').click()
  },
)

Cypress.Commands.add('database', (operation: 'select' | 'delete' | 'insert', tableName: string, query: any = {}) => {
  return cy.task('queryDatabase', { operation, tableName, query })
})
