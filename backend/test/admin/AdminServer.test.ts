import http from 'http'
import { AddressInfo } from 'net'

import { NextFunction, Request, Response } from 'express'
import winston from 'winston'

import { AdminDeps, createAdminApp, isLoopbackAddress, loopbackOnly } from '../../src/admin/AdminServer'

const logger = winston.createLogger({ silent: true })

function makeDeps() {
  const deps = {
    userManager: {
      getByUsername: jest.fn(async (username: string) => (username === 'Dobrokot' ? { id: 1625 } : undefined)),
      userCacheStats: jest.fn(() => ({ byId: 3, byUsername: 4 })),
      inspectUserCache: jest.fn(() => ({
        byId: { id: 1625, username: 'Stervo' },
        usernameKeys: ['Dobrokot', 'Stervo'],
        consistent: false,
      })),
      getUserInfoFromDb: jest.fn(async () => ({ id: 1625, username: 'Stervo' })),
      evictUserCaches: jest.fn(() => ({
        byId: true,
        usernameKeys: ['Dobrokot'],
        restrictions: false,
        lastVisit: true,
      })),
      clearAllCaches: jest.fn(() => ({ byId: 3 })),
      rebuildUsernameSuggestions: jest.fn(async () => 2222),
      evictKarmaCaches: jest.fn(async () => ['active_karma_votes_1625']),
      evictAllKarmaCaches: jest.fn(async () => ({ 'active_karma_votes_*': 2 })),
    },
    siteManager: { clearCache: jest.fn(() => 2), cacheStats: jest.fn(() => ({ byName: 1, byId: 1 })) },
    feedManager: { clearUserSubscriptionsCache: jest.fn(() => 1), userSubscriptionsCacheStats: jest.fn(() => 5) },
    postManager: {
      clearContentNumberCache: jest.fn(() => ({ posts: 1, comments: 0 })),
      contentNumberCacheStats: jest.fn(() => ({ posts: 2, comments: 2 })),
    },
    inviteManager: { clearInvitesAvailabilityCache: jest.fn(() => 0), invitesAvailabilityCacheStats: jest.fn(() => 0) },
  }
  return deps
}

type Reply = { status: number; body: { result: string; payload?: any; code?: string; message?: string } }

function request(port: number, method: string, path: string, body?: unknown): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body)
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers: data ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }))
      },
    )
    req.on('error', reject)
    if (data) {
      req.write(data)
    }
    req.end()
  })
}

describe('admin server', () => {
  let server: http.Server
  let port: number
  let deps: ReturnType<typeof makeDeps>

  beforeEach(async () => {
    deps = makeDeps()
    server = http.createServer(createAdminApp(deps as unknown as AdminDeps, logger))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  test('GET / lists every route', async () => {
    const reply = await request(port, 'GET', '/')
    expect(reply.status).toBe(200)
    const paths = reply.body.payload.routes.map((route) => `${route.method} ${route.path}`)
    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /cache/stats',
        'GET /cache/users/inspect',
        'POST /cache/users/evict',
        'POST /cache/usernames/rebuild',
        'POST /cache/karma/evict',
        'POST /cache/sessions/evict',
      ]),
    )
  })

  test('evicting by username resolves through the cache and fans out to every per-user cache', async () => {
    const reply = await request(port, 'POST', '/cache/users/evict', { username: 'Dobrokot' })
    expect(reply.status).toBe(200)
    expect(reply.body.payload).toEqual({
      userId: 1625,
      user: { byId: true, usernameKeys: ['Dobrokot'], restrictions: false, lastVisit: true },
      feedSubscriptions: 1,
      contentCounters: { posts: 1, comments: 0 },
      invitesAvailability: 0,
    })
    expect(deps.userManager.evictUserCaches).toHaveBeenCalledWith(1625)
    expect(deps.feedManager.clearUserSubscriptionsCache).toHaveBeenCalledWith(1625)
    expect(deps.postManager.clearContentNumberCache).toHaveBeenCalledWith(1625)
    expect(deps.inviteManager.clearInvitesAvailabilityCache).toHaveBeenCalledWith(1625)
  })

  test('an unknown username is a 404, missing params are a 400', async () => {
    expect((await request(port, 'POST', '/cache/users/evict', { username: 'nobody' })).status).toBe(404)
    expect((await request(port, 'POST', '/cache/users/evict', {})).status).toBe(400)
    expect((await request(port, 'POST', '/cache/users/evict', { userId: 1, username: 'x' })).status).toBe(400)
    expect(deps.userManager.evictUserCaches).not.toHaveBeenCalled()
  })

  test('inspect reports drift between the cache and the DB', async () => {
    const reply = await request(port, 'GET', '/cache/users/inspect?userId=1625')
    expect(reply.status).toBe(200)
    expect(reply.body.payload.drift).toBe(true)
    expect(reply.body.payload.cache.consistent).toBe(false)
    expect(deps.userManager.getUserInfoFromDb).toHaveBeenCalledWith(1625)
  })

  test('karma eviction passes asVoter through and defaults it to false', async () => {
    await request(port, 'POST', '/cache/karma/evict', { userId: 7, asVoter: true })
    expect(deps.userManager.evictKarmaCaches).toHaveBeenLastCalledWith(7, true)
    await request(port, 'POST', '/cache/karma/evict', { userId: 7 })
    expect(deps.userManager.evictKarmaCaches).toHaveBeenLastCalledWith(7, false)
  })

  test('trie rebuild and site eviction return their counts', async () => {
    expect((await request(port, 'POST', '/cache/usernames/rebuild')).body.payload).toEqual({ usernames: 2222 })
    expect((await request(port, 'POST', '/cache/sites/evict', { site: 'main' })).body.payload).toEqual({ removed: 2 })
    expect(deps.siteManager.clearCache).toHaveBeenCalledWith({ siteId: undefined, site: 'main' })
    expect((await request(port, 'POST', '/cache/sites/evict-all')).body.payload).toEqual({ removed: 2 })
    expect(deps.siteManager.clearCache).toHaveBeenLastCalledWith()
  })

  test('stats aggregates every cache', async () => {
    const reply = await request(port, 'GET', '/cache/stats')
    expect(reply.body.payload).toMatchObject({
      users: { byId: 3 },
      sites: { byName: 1 },
      feedSubscriptions: 5,
      contentCounters: { posts: 2 },
      sessions: { sessions: expect.any(Number) },
    })
  })

  test('unknown endpoints and malformed JSON get JSON errors', async () => {
    expect((await request(port, 'POST', '/cache/nope')).status).toBe(404)
    const bad = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/cache/users/evict',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          res.resume()
          res.on('end', () => resolve(res.statusCode))
        },
      )
      req.on('error', reject)
      req.end('{not json')
    })
    expect(bad).toBe(400)
  })
})

describe('loopback guard', () => {
  test('recognises loopback peers only', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('172.18.0.5')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
  })

  test('rejects a non-loopback peer with 403 and never calls next', () => {
    const middleware = loopbackOnly(logger)
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const next = jest.fn()
    middleware(
      { socket: { remoteAddress: '172.18.0.5' }, url: '/cache/stats' } as unknown as Request,
      { status } as unknown as Response,
      next as NextFunction,
    )
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'forbidden' }))
    expect(next).not.toHaveBeenCalled()

    middleware(
      { socket: { remoteAddress: '::1' }, url: '/' } as unknown as Request,
      { status } as unknown as Response,
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
  })
})
