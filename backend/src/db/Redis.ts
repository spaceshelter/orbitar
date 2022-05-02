import {RedisClientType, createClient} from 'redis';
import {Logger} from 'winston';

type RedisConfig = {
    host: string;
    port: number;
    password: string;
};

export default class Redis {
    client: RedisClientType;
    private logger: Logger;

    constructor(config: RedisConfig, logger: Logger) {
        this.logger = logger;
        this.client = createClient({
            url: `redis://${config.host}:${config.port}/`,
            password: config.password
        });
    }

    async connect() {
        await this.client.connect();
        this.logger.verbose('Redis connected');
    }
}
