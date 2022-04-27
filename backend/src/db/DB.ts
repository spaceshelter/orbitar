import {createPool, OkPacket, ResultSetHeader, RowDataPacket} from 'mysql2'
import {Pool, PoolConnection} from 'mysql2/promise'
import {Logger} from 'winston';

interface DBOptions {
    host: string;
    port: number;
    user: string;
    database: string;
    password: string;
}

export default class DB {
    private readonly pool: Pool
    private readonly logger: Logger;

    constructor(options: DBOptions, logger: Logger) {
        this.logger = logger;

        try {
            this.logger.verbose('Creating connection pool');
            this.pool = createPool({
                connectionLimit: 50,
                host: options.host,
                port: options.port,
                user: options.user,
                password: options.password,
                database: options.database,
                namedPlaceholders: true
            }).promise();
            this.logger.info('Created connection pool');
        }
        catch (e) {
            this.logger.error('Failed to initialize connection pool', { error: e });
            throw e;
        }
    }

    async ping() {
        this.logger.verbose('Ping database');
        let start = new Date().getTime();
        await this.pool.execute('select 1');
        let diff = new Date().getTime() - start;
        this.logger.verbose(`Database alive: ${diff}ms`, { pong: diff });
        return diff;
    }

    async query<T = RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
        query: string, params: string[] | Object, connection?: PoolConnection): Promise<T> {
        this.logger.verbose('Query', { query: query, params: params });

        const conn: Pool | PoolConnection = connection || this.pool

        try {
            return (await conn.query(query, params))[0] as undefined as T
        }
        catch (e) {
            this.logger.error(e);
            throw e;
        }
    }

    async fetchOne<T = any>(query: string, params: string[] | Object, connection?: PoolConnection): Promise<T | undefined> {
        return (await this.query<T[]>(query, params, connection))[0];
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
        }
        finally {
            conn.release()
        }
    }
}
