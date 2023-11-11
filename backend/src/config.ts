type Config = {
    port: number;
    logLevel: string;
    mysql: MysqlConfig;
    redis: RedisConfig;
    vapid: VapidConfig;
    site: SiteConfig;
    mediaHosting: MediaHostingConfig;
    feed: FeedConfig;
    barmalini: BarmaliniConfig;
    openai: OpenAIConfig;
};

export type MysqlConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export type RedisConfig = {
    host: string;
    port: number;
    password: string;
};

export type VapidConfig = {
    publicKey: string;
    privateKey: string;
    contact: string;
};

export type SiteConfig = {
    domain: string;
    http: boolean;
};

export type MediaHostingConfig = {
    url: string;
    dimsAesKey: string;
};

export type FeedConfig = {
    host: string;
    port: number;
};

export type BarmaliniConfig = {
    userId: number | undefined;
    key: string;
};

export type OpenAIConfig = {
    apiKey: string;
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
    },
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
        contact: process.env.VAPID_CONTACT || '',
    },
    site: {
        domain: process.env.SITE_DOMAIN || 'idiod.local',
        http: process.env.SITE_HTTP === 'true',
    },
    mediaHosting: {
        url: process.env.MEDIA_HOSTING_URL || 'https://orbitar.media',
        dimsAesKey: process.env.MEDIA_HOSTING_DIMS_AES_KEY || ''
    },
    feed: {
        host: process.env.FEED_INDEX_HOST || 'feed',
        port: parseInt(process.env.FEED_INDEX_PORT) || 6767,
    },
    barmalini: {
        userId: process.env.BARMALINI_USER_ID ? parseInt(process.env.BARMALINI_USER_ID) : undefined,
        key: process.env.BARMALINI_KEY || '',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
    }
};
