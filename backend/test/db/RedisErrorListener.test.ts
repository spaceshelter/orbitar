import { EventEmitter } from 'events'

import Redis from '../../src/db/Redis'

jest.mock('redis', () => ({
  createClient: () => {
    const client = new EventEmitter() as EventEmitter & { connect: jest.Mock }
    client.connect = jest.fn().mockResolvedValue(undefined)
    return client
  },
}))

const makeRedis = () => {
  const logger = { verbose: jest.fn(), error: jest.fn() }
  const redis = new Redis({ host: 'redis', port: 6379, password: 'secret' }, logger as never)
  return { redis, logger, client: redis.client as unknown as EventEmitter & { connect: jest.Mock } }
}

describe('Redis', () => {
  test('a socket error after connect is logged instead of being thrown as an uncaught exception', async () => {
    const { redis, logger, client } = makeRedis()

    await redis.connect()

    expect(client.listenerCount('error')).toBe(1)
    const error = new Error('Socket closed unexpectedly')
    expect(() => client.emit('error', error)).not.toThrow()
    expect(logger.error).toHaveBeenCalledWith('Redis client error', { error })
  })

  test('nothing listens for errors before connect resolves, so an unreachable Redis still fails fast', async () => {
    const { redis, client } = makeRedis()

    expect(client.listenerCount('error')).toBe(0)

    client.connect.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:6379'))
    await expect(redis.connect()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:6379')

    // Attaching the listener in the constructor would make node-redis retry the initial connect
    // forever instead of rejecting, so the server would hang at startup rather than exit.
    expect(client.listenerCount('error')).toBe(0)
  })
})
