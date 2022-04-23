import {createPool, OkPacket, ResultSetHeader, RowDataPacket} from 'mysql2'
import {Pool, PoolConnection} from 'mysql2/promise'

interface DBOptions {
    host: string;
    user: string;
    database: string;
    password: string;
}

export default class DB {
    private readonly pool: Pool

    constructor(options: DBOptions) {
        try {
            this.pool = createPool({
                connectionLimit: 50,
                host: options.host,
                user: options.user,
                password: options.password,
                database: options.database,
                namedPlaceholders: true
            }).promise()

            console.log('Mysql pool is up')
        } catch (e) {
            console.error('DB', e)
            throw new Error('Failed to initialize database pool')
        }
    }

    async execute<T = RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
        query: string, params: string[] | Object, connection?: PoolConnection): Promise<T> {
        const conn: Pool | PoolConnection = connection || this.pool

        if (!this.pool) {
            throw new Error('Database pool was not created')
        }
        try {
            return (await conn.query(query, params))[0] as undefined as T
        } catch (e) {
            console.error('DB', e)
            throw new Error('Failed to execute database query')
        }
    }

    async fetchOne<T = any>(query: string, params: string[] | Object, connection?: PoolConnection): Promise<T | undefined> {
        return (await this.execute<T[]>(query, params, connection))[0];
    }

    /**
     * Usage:
     * await beginTransaction(async (conn) => {
     *   await conn.query('...')
     *   await conn.query('...')
     * })
     * //connection will be released automatically
     * @param transactionFunc
     *
     *  Note: never hold onto the connection fetched from the pool
     */
    async beginTransaction<T>(transactionFunc: (conn: PoolConnection) => Promise<T>): Promise<T> {
        const conn = await this.pool.getConnection()
        try {
            return await transactionFunc(conn)
        } finally {
            conn.release()
        }
    }
}
