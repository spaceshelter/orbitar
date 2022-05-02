type Config = {
    port: number;
    logLevel: string;
    mysql: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    },
    redis: {
        host: string;
        port: number;
        password: string;
    }
};

export const config: Config = {
    port: parseInt(process.env.SERVER_PORT) || 5001,
    logLevel: process.env.LOG_LEVEL || 'info',
    mysql: {
        host: process.env.MYSQL_HOST || 'mysql',
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'orbitar',
        password: process.env.MYSQL_PASSWORD || 'orbitar',
        database: process.env.MYSQL_DATABASE || 'orbitar_db',
    },
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || 'orbitar'
    }
};
