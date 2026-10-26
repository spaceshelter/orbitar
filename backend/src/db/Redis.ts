import { createClient, RedisClientType } from 'redis'
import { Logger } from 'winston'

type RedisConfig = {
  host: string
  port: number
  password: string
}

export default class Redis {
  client: RedisClientType
  private logger: Logger

  constructor(config: RedisConfig, logger: Logger) {
    this.logger = logger
    this.client = createClient({
      url: `redis://${config.host}:${config.port}/`,
      password: config.password,
    })
  }

  async connect() {
    this.logger.verbose('Redis connecting...')
    await this.client.connect()
    // The client is an EventEmitter and node-redis emits 'error' on every socket failure, so with no
    // listener registered an error after a successful connect is thrown as an uncaughtException and
    // Node exits - before the client's own reconnect loop can run. Log it instead and let the client
    // reconnect.
    //
    // The listener is attached HERE rather than in the constructor on purpose: during the initial
    // connect, the unlistened error is exactly what makes connect() reject, which app.ts turns into a
    // fail-fast exit. With a listener in place from the constructor, connect() against an unreachable
    // Redis retries forever instead of rejecting, and the server never binds its port.
    this.client.on('error', (error) => {
      this.logger.error('Redis client error', { error })
    })
    this.logger.verbose('Redis connected')
  }
}
