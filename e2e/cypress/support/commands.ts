/// <reference types="cypress" />

import { OkPacketParams } from 'mysql2'

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

Cypress.Commands.add(
  'database',
  (
    operation: Operation,
    entity: Table,
    query?: SelectQuery | DeleteQuery | UpdateQuery | InsertQuery,
    logTask = false,
  ) => {
    const params = { entity, query }

    const log = Cypress.log({
      name: 'database',
      displayName: 'DATABASE',
      message: [`🔎 ${operation} in ${entity}`],
      autoEnd: false,
      consoleProps() {
        return params
      },
    })

    return cy.task<OkPacketParams>(`${operation}:database`, params, { log: logTask }).then((data) => {
      const resultCount = data.affectedRows || 0

      let message: string

      switch (operation) {
        case 'find':
        case 'findall':
          message = `🔍 Found ${resultCount} record(s)`
          break
        case 'delete':
        case 'deleteall':
          message = `🗑️ Deleted ${resultCount} record(s)`
          break
        case 'update':
          message = `📝 Updated ${resultCount} record(s)`
          break
        case 'insert':
          message = `➕ Inserted ${resultCount} record(s)`
          break
        default:
          message = `✔️ Operation ${operation} completed (${resultCount})`
      }

      log.set({
        message: message,
      })

      log.snapshot()
      log.end()
      return data
    })
  },
)

Cypress.Commands.add('getBySel', (selector, ...args) => {
  console.log('getBySel', `[data-testid=${selector}]`, ...args)
  return cy.get(`[data-testid=${selector}]`, ...args)
})
