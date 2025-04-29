declare global {
  export const operation = ['select', 'delete', 'insert', 'update', 'find', 'findall', 'deleteall'] as const
  export const tables = ['posts', 'comments', 'users'] as const

  export type Operation = (typeof operation)[number]
  export type Table = (typeof tables)[number]
  interface BaseQuery {
    field: string
    value: string | number
  }

  interface SelectQuery extends BaseQuery {}

  interface DeleteQuery extends BaseQuery {}

  interface UpdateQuery extends BaseQuery {
    data: Record<string, any>
  }

  interface InsertQuery {
    data: Record<string, any>
  }

  export interface QueryArgs {
    operation: Operation
    tableName: TableName
    query?: SelectQuery | DeleteQuery | UpdateQuery | InsertQuery
  }

  namespace Cypress {
    interface Chainable {
      loginViaAPI(username: string, password: string): Chainable
      database(operation: 'find', tableName: Table, query: SelectQuery, logTask?: boolean): Chainable<any>
      database(operation: 'findall', tableName: Table, query?: undefined, logTask?: boolean): Chainable<any>
      database(operation: 'delete', tableName: Table, query: DeleteQuery, logTask?: boolean): Chainable<any>
      database(operation: 'deleteall', tableName: Table, query?: undefined, logTask?: boolean): Chainable<any>
      database(operation: 'insert', tableName: Table, query: InsertQuery, logTask?: boolean): Chainable<any>
      database(operation: 'update', tableName: Table, query: UpdateQuery, logTask?: boolean): Chainable<any>
      getBySel(dataTestAttribute: string, args?: any): Chainable<JQuery<HTMLElement>>
    }
  }
}

export {}
