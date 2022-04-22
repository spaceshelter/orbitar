import {createPool, Pool, PoolConnection, RowDataPacket} from 'mysql2';

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
            });

            console.log('Mysql pool is up');
        }
        catch (e) {
            console.error('DB', e);
            throw new Error('Failed to initialize database pool')
        }
    }

    async execute(query: string, params: string[] | Object, connection?: PoolConnection) {
        let conn: Pool | PoolConnection = connection || this.pool;

        if (!this.pool) {
            throw new Error('Database pool was not created');
        }

        try {
            return new Promise((resolve, reject) => {
                conn.query(query, params, (error, results) => {
                    if (error) {
                        console.error('DB', error);
                        reject(error);
                    }
                    else {
                        const rows = (<RowDataPacket[]> results)
                        resolve(rows);
                    }
                });
            })
        }
        catch (e) {
            console.error('DB', e);
            throw new Error('Failed to execute database query');
        }
    }

    beginTransaction(): Promise<PoolConnection> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }

                connection.beginTransaction((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve(connection);
                })
            })
        })
    }

    commit(connection: PoolConnection): Promise<void> {
        return new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            })
        })
    }

    rollback(connection: PoolConnection): Promise<void> {
        return new Promise((resolve) => {
            connection.rollback(() => {
                resolve();
            })
        })
    }
}
