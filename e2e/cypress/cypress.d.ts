declare global {
  namespace Cypress {
    interface Chainable {
      login(username?: string, password?: string): Chainable
      database(
        operation: 'select' | 'delete' | 'insert',
        tableName: string,
        query: { field: string; value: string | number | boolean; data?: any },
      ): Chainable
    }
  }
}

export {}
