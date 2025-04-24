import mysql from 'mysql2/promise'

const operation = ['select', 'delete', 'insert'] as const
const tables = ['posts', 'comments', 'users'] as const

type Operation = (typeof operation)[number]

interface QueryArgs {
  operation: Operation
  tableName: (typeof tables)[number]
  query: { field: string; value: string | number | boolean; data?: any }
}

export function setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
  on('task', {
    async queryDatabase({ operation, tableName, query }: QueryArgs) {
      const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'orbitar',
        password: 'orbitar',
        database: 'orbitar_db',
        port: 3307,
      })

      const { field, value, data } = query
      try {
        const { query, params } = buildQuery(operation, tableName, field, value, data)

        const [rows] = await connection.execute(query, params)
        return rows
      } catch (err) {
        throw new Error('Database query failed')
      } finally {
        await connection.end()
      }
    },
  })

  return config
}

const buildQuery = (
  operation: Operation,
  tableName: (typeof tables)[number],
  field: string,
  value: string | number | boolean,
  data?: any,
): { query: string; params: string[] } => {
  let query: string
  let params: any[]

  switch (operation) {
    case 'select':
      query = `SELECT * FROM \`${tableName}\` WHERE \`${field}\` = ?`
      params = [value]
      break

    case 'delete':
      query = `DELETE FROM \`${tableName}\` WHERE \`${field}\` = ?`
      params = [value]
      break

    case 'insert':
      query = `INSERT INTO \`${tableName}\` SET ?`
      params = [data]
      break

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }

  return { query, params }
}
