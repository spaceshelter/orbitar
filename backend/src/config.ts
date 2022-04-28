type Config = {
    mysql: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    },
    port: number;
    logLevel: string;
};

export const config: Config = {
    mysql: {
        host: process.env.MYSQL_HOST || 'mysql',
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'orbitar',
        password: process.env.MYSQL_PASSWORD || 'orbitar',
        database: process.env.MYSQL_DATABASE || 'orbitar_db',
    },
    port: parseInt(process.env.SERVER_PORT) || 5001,
    logLevel: process.env.LOG_LEVEL || 'info'
};
