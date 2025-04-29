import mysql from 'mysql2/promise'

export function setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
  on('task', {
    async 'find:database'(payload: { entity: Table; query: SelectQuery }) {
      return queryDatabase({ operation: 'select', tableName: payload.entity, query: payload.query })
    },
    async 'findall:database'(payload) {
      return queryDatabase({ operation: 'select', tableName: payload.entity })
    },
    async 'insert:database'(payload) {
      return queryDatabase({ operation: 'insert', tableName: payload.entity, query: payload.query })
    },
    async 'update:database'(payload) {
      return queryDatabase({ operation: 'update', tableName: payload.entity, query: payload.query })
    },
    async 'delete:database'(payload) {
      return queryDatabase({ operation: 'delete', tableName: payload.entity, query: payload.query })
    },
    async 'deleteall:database'(payload) {
      return queryDatabase({ operation: 'delete', tableName: payload.entity })
    },
  })

  return config
}

async function queryDatabase({ operation, tableName, query }: QueryArgs) {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'orbitar',
    password: 'orbitar',
    database: 'orbitar_db',
    port: 3307,
  })

  try {
    const { sqlQuery, params } = buildQuery(operation, tableName, query)

    const [rows] = await connection.execute(sqlQuery, params)
    return rows
  } catch (err) {
    throw new Error('Database query failed')
  } finally {
    await connection.end()
  }
}

const buildQuery = (
  operation: Operation,
  tableName: Table,
  query?: SelectQuery | DeleteQuery | UpdateQuery | InsertQuery,
): { sqlQuery: string; params: any[] } => {
  let sqlQuery: string = ''
  let params: any[] = []

  switch (operation) {
    case 'select':
      if (query) {
        const selectQuery = query as SelectQuery
        sqlQuery = `SELECT * FROM \`${tableName}\` WHERE \`${selectQuery.field}\` = ?`
        params = [selectQuery.value]
      } else {
        sqlQuery = `SELECT * FROM \`${tableName}\``
      }
      break

    case 'delete':
      if (query) {
        const deleteQuery = query as DeleteQuery
        sqlQuery = `DELETE FROM \`${tableName}\` WHERE \`${deleteQuery.field}\` = ?`
        params = [deleteQuery.value]
      } else {
        sqlQuery = `DELETE FROM \`${tableName}\``
      }
      break

    case 'insert':
      if (query) {
        const insertQuery = query as InsertQuery
        sqlQuery = `INSERT INTO \`${tableName}\` SET ?`
        params = [insertQuery.data]
      }
      break

    case 'update':
      if (query) {
        const updateQuery = query as UpdateQuery
        sqlQuery = `UPDATE \`${tableName}\` SET ? WHERE \`${updateQuery.field}\` = ?`
        params = [updateQuery.data, updateQuery.value]
      } else {
        throw new Error('For update, both field and value must be provided')
      }
      break

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }

  return { sqlQuery, params }
}
