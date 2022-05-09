import {createPool, OkPacket, ResultSetHeader, RowDataPacket} from 'mysql2';
import {Pool, PoolConnection} from 'mysql2/promise';
import {Logger} from 'winston';

interface DBOptions {
    host: string;
    port: number;
    user: string;
    database: string;
    password: string;
}

export class DBConnection {
    protected connection: PoolConnection | Pool;
    protected logger: Logger;

    constructor(connection: PoolConnection | Pool, logger: Logger) {
        this.connection = connection;
        this.logger = logger;
    }

    async query<T = RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
        query: string, params: string[] | object): Promise<T> {
        this.logger.verbose('Query', { query: query, params: params });

        try {
            return (await this.connection.query(query, params))[0] as undefined as T;
        }
        catch (error) {
            this.logger.error('Query failed', error);
            throw error;
        }
    }

    async fetchAll<T = object>(query: string, params: string[] | object): Promise<T[]> {
        return (await this.query<T[]>(query, params));
    }

    async fetchOne<T = object>(query: string, params: string[] | object): Promise<T | undefined> {
        return (await this.query<T[]>(query, params))[0];
    }

    async insert(table: string, values: Record<string, unknown>): Promise<number> {
        const {keys, valueKeys} = Object.entries(values).reduce((p, [k, v]) => {
            p.keys.push('`' + k + '`');
            p.valueKeys.push(':' + k);
            if (v === undefined) {
                values[k] = null;
            }
            return p;
        }, { keys: [], valueKeys: [] });
        const query = 'insert into `' + table + '` (' + keys.join(',') + ') values (' + valueKeys.join(',') + ')';
        const insertResult: ResultSetHeader = await this.query(query, values);
        if (insertResult.affectedRows < 1) {
            this.logger.error('Could not insert record', { table, values, insertResult });
            throw new Error('Could not insert record');
        }
        return insertResult.insertId;
    }

    async inTransaction<T>(transactionFunc: (connection: DBConnection) => Promise<T>): Promise<T> {
        if (!('beginTransaction' in this.connection)) {
            throw new Error('Could not start transaction');
        }

        await this.connection.beginTransaction();

        try {
            const result = await transactionFunc(this);
            await this.connection.commit();
            return result;
        }
        catch (err) {
            await this.connection.rollback();
            throw err;
        }
    }
}

export default class DB extends DBConnection {
    private pool: Pool;

    constructor(options: DBOptions, logger: Logger) {
        const pool = createPool({
            connectionLimit: 50,
            host: options.host,
            port: options.port,
            user: options.user,
            password: options.password,
            database: options.database,
            namedPlaceholders: true,
            timezone: '+00:00'
        }).promise();

        super(pool, logger);
        this.pool = pool;
    }

    async ping() {
        this.logger.verbose('Ping database');
        const start = new Date().getTime();
        await this.pool.execute('select 1');
        const diff = new Date().getTime() - start;
        this.logger.verbose(`Database alive: ${diff}ms`, { pong: diff });
        return diff;
    }

    /**
     * Usage:
     * await inTransaction(async (conn) => {
     *   await conn.query('...')
     *   await conn.query('...')
     *   if (error) {
     *     throw new Error('Throw error to rollback');
     *   }
     *   await conn.inTransaction(async (conn) => {
     *       // nested transaction
     *   })
     * })
     * //connection will be released automatically
     * @param transactionFunc
     *
     *  Note: never hold onto the connection fetched from the pool
     */
    async inTransaction<T>(transactionFunc: (connection: DBConnection) => Promise<T>): Promise<T> {
        const conn = await this.pool.getConnection();
        const db = new DBConnection(conn, this.logger);
        try {
            return await db.inTransaction(transactionFunc);
        }
        finally {
            conn.release();
        }
    }
}
