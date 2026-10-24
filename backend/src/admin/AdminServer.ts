import http from 'http'

import express, { NextFunction, Request, Response } from 'express'
import Joi from 'joi'
import { Logger } from 'winston'

import FeedManager from '../managers/FeedManager'
import InviteManager from '../managers/InviteManager'
import PostManager from '../managers/PostManager'
import SiteManager from '../managers/SiteManager'
import UserManager from '../managers/UserManager'
import { evictSessionFromMemory, evictSessionsFromMemory, sessionMemoryStats } from '../session/Session'

/**
 * Loopback-only operations server.
 *
 * It listens on 127.0.0.1 inside the backend container, so the only way to reach it is
 * `docker exec <backend> curl localhost:<ADMIN_PORT>/...`, i.e. root access to the box.
 * Nothing here is proxied by Caddy and there are no credentials to leak.
 *
 * Every route is a building block over a single cache. Anything that is already easy to do
 * with SQL or redis-cli (data changes, re-parsing content via parser_version, ...) does not
 * belong here; this exists only for state that lives in the process memory or that cannot
 * be targeted safely from outside.
 *
 * Responses use the same {result, payload} envelope as the public API. `GET /` lists the routes.
 */

export type AdminDeps = {
  userManager: UserManager
  siteManager: SiteManager
  feedManager: FeedManager
  postManager: PostManager
  inviteManager: InviteManager
}

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function isLoopbackAddress(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK_ADDRESSES.has(address)
}

/**
 * Defense in depth: the server already binds to 127.0.0.1, this rejects anything else that could
 * still get through (a changed bind address, a misconfigured proxy). Checks the raw TCP peer, not
 * `req.ip`, because the latter honours X-Forwarded-For.
 */
export function loopbackOnly(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const address = req.socket.remoteAddress
    if (!isLoopbackAddress(address)) {
      logger.warn('Rejected admin request from a non-loopback address', { address, url: req.url })
      res.status(403).json({ result: 'error', code: 'forbidden', message: 'Admin API is loopback-only' })
      return
    }
    next()
  }
}

type AdminParams = Record<string, unknown>

type AdminRoute = {
  method: 'GET' | 'POST'
  path: string
  description: string
  schema: Joi.ObjectSchema
  handler: (params: AdminParams) => Promise<unknown>
}

const userRef = Joi.object({
  userId: Joi.number().integer().positive(),
  username: Joi.string(),
}).xor('userId', 'username')

const noParams = Joi.object({})

/**
 * A username is resolved through the user cache first (then the DB), on purpose: the typical
 * reason to evict by name is that the cache still holds a name the DB no longer has.
 */
async function resolveUserId(userManager: UserManager, params: AdminParams): Promise<number> {
  if (typeof params.userId === 'number') {
    return params.userId
  }
  const username = String(params.username)
  const user = await userManager.getByUsername(username)
  if (!user) {
    throw new AdminError(404, 'not-found', `User "${username}" is neither cached nor in the DB`)
  }
  return user.id
}

/** Session ids are bearer credentials; keep them out of the (root-readable) logs. */
function maskSecrets(params: AdminParams): AdminParams {
  if (typeof params.sessionId !== 'string') {
    return params
  }
  return { ...params, sessionId: params.sessionId.slice(0, 6) + '…' }
}

export function buildAdminRoutes(deps: AdminDeps): AdminRoute[] {
  const { userManager, siteManager, feedManager, postManager, inviteManager } = deps
  return [
    {
      method: 'GET',
      path: '/cache/stats',
      description: 'Sizes of every in-process cache.',
      schema: noParams,
      handler: async () => ({
        users: userManager.userCacheStats(),
        sites: siteManager.cacheStats(),
        feedSubscriptions: feedManager.userSubscriptionsCacheStats(),
        contentCounters: postManager.contentNumberCacheStats(),
        invitesAvailability: inviteManager.invitesAvailabilityCacheStats(),
        sessions: sessionMemoryStats(),
      }),
    },
    {
      method: 'GET',
      path: '/cache/users/inspect',
      description:
        'Cached user entries next to the DB row (userId or username). ' +
        '`drift` is true when a cached username differs from the DB, `cache.consistent` is false when a username key is orphaned.',
      schema: userRef,
      handler: async (params) => {
        const userId = await resolveUserId(userManager, params)
        const cache = userManager.inspectUserCache(userId)
        const db = await userManager.getUserInfoFromDb(userId)
        const dbUsername = db ? db.username : undefined
        const drift =
          (cache.byId !== undefined && cache.byId.username !== dbUsername) ||
          cache.usernameKeys.some((username) => username !== dbUsername)
        return { userId, cache, db, drift }
      },
    },
    {
      method: 'POST',
      path: '/cache/users/evict',
      description:
        'Evict one user (userId or username) from every in-process cache: identity by id and by any username key, ' +
        'restrictions, last visit, feed subscriptions, content counters, invite availability. ' +
        'A username is looked up in the cache first, so a stale name still works.',
      schema: userRef,
      handler: async (params) => {
        const userId = await resolveUserId(userManager, params)
        return {
          userId,
          user: userManager.evictUserCaches(userId),
          feedSubscriptions: feedManager.clearUserSubscriptionsCache(userId),
          contentCounters: postManager.clearContentNumberCache(userId),
          invitesAvailability: inviteManager.clearInvitesAvailabilityCache(userId),
        }
      },
    },
    {
      method: 'POST',
      path: '/cache/users/evict-all',
      description:
        'Drop every in-process user cache. The username suggestions trie is kept, rebuild it separately. ' +
        'Returns the sizes that were dropped.',
      schema: noParams,
      handler: async () => ({
        user: userManager.clearAllCaches(),
        feedSubscriptions: feedManager.clearUserSubscriptionsCache(),
        contentCounters: postManager.clearContentNumberCache(),
        invitesAvailability: inviteManager.clearInvitesAvailabilityCache(),
      }),
    },
    {
      method: 'POST',
      path: '/cache/usernames/rebuild',
      description:
        'Rebuild the username suggestions trie (@mention autocomplete) from the DB. ' +
        'The trie only grows on registration, so renames and deletions need this.',
      schema: noParams,
      handler: async () => ({ usernames: await userManager.rebuildUsernameSuggestions() }),
    },
    {
      method: 'POST',
      path: '/cache/karma/evict',
      description:
        'Delete the Redis karma caches of one user (userId or username): active_karma_votes, trial_progress, ' +
        'remove_votes_when_karma_is_low, is_user_active. With asVoter=true also active_karma_votes_<targetId> of ' +
        'everyone the user has karma-voted: that value is a map keyed by voter username, so it goes stale on a rename. ' +
        'karma_penalty is state, never touched.',
      schema: userRef.keys({ asVoter: Joi.boolean().default(false) }),
      handler: async (params) => {
        const userId = await resolveUserId(userManager, params)
        return { userId, deleted: await userManager.evictKarmaCaches(userId, params.asVoter === true) }
      },
    },
    {
      method: 'POST',
      path: '/cache/karma/evict-all',
      description:
        'Delete every Redis karma cache key, same families as /cache/karma/evict. Returns counts per pattern.',
      schema: noParams,
      handler: async () => ({ deleted: await userManager.evictAllKarmaCaches() }),
    },
    {
      method: 'POST',
      path: '/cache/sites/evict',
      description: 'Evict one site from the in-process site cache (siteId or site subdomain).',
      schema: Joi.object({
        siteId: Joi.number().integer().positive(),
        site: Joi.string(),
      }).xor('siteId', 'site'),
      handler: async (params) => ({
        removed: siteManager.clearCache({ siteId: params.siteId as number, site: params.site as string }),
      }),
    },
    {
      method: 'POST',
      path: '/cache/sites/evict-all',
      description: 'Drop the whole in-process site cache.',
      schema: noParams,
      handler: async () => ({ removed: siteManager.clearCache() }),
    },
    {
      method: 'POST',
      path: '/cache/sessions/evict',
      description:
        'Drop in-memory session entries for a user (userId) or one session (sessionId). ' +
        'The sessions table is not touched: delete rows there first when the goal is a forced logout, ' +
        'the process keeps honouring cached sessions until they are evicted here.',
      schema: Joi.object({
        userId: Joi.number().integer().positive(),
        sessionId: Joi.string(),
      }).xor('userId', 'sessionId'),
      handler: async (params) =>
        typeof params.sessionId === 'string'
          ? { removed: evictSessionFromMemory(params.sessionId) ? 1 : 0 }
          : { removed: evictSessionsFromMemory(params.userId as number) },
    },
  ]
}

export function createAdminApp(deps: AdminDeps, logger: Logger): express.Express {
  const routes = buildAdminRoutes(deps)
  const app = express()
  app.disable('x-powered-by')
  app.use(loopbackOnly(logger))
  app.use(express.json())

  app.get('/', (req, res) => {
    res.json({
      result: 'success',
      payload: { routes: routes.map(({ method, path, description }) => ({ method, path, description })) },
    })
  })

  for (const route of routes) {
    const handle = async (req: Request, res: Response) => {
      const raw = route.method === 'GET' ? req.query : req.body
      const { error, value } = route.schema.validate(raw || {}, { convert: true })
      if (error) {
        res.status(400).json({ result: 'error', code: 'invalid-params', message: error.message })
        return
      }
      const params = value as AdminParams
      const loggedParams = maskSecrets(params)
      try {
        const payload = await route.handler(params)
        logger.info(`${route.method} ${route.path}`, { params: loggedParams, payload })
        res.json({ result: 'success', payload })
      } catch (err) {
        if (err instanceof AdminError) {
          logger.warn(`${route.method} ${route.path}: ${err.message}`, { params: loggedParams })
          res.status(err.status).json({ result: 'error', code: err.code, message: err.message })
          return
        }
        logger.error(`${route.method} ${route.path} failed`, { params: loggedParams, error: err })
        res.status(500).json({
          result: 'error',
          code: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
    if (route.method === 'GET') {
      app.get(route.path, handle)
    } else {
      app.post(route.path, handle)
    }
  }

  app.all('*', (req, res) => {
    res.status(404).json({ result: 'error', code: '404', message: 'Unknown admin endpoint, GET / lists them' })
  })

  // malformed JSON bodies end up here
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    res.status(400).json({ result: 'error', code: 'bad-request', message: err.message })
  })

  return app
}

/**
 * Starts the admin server on 127.0.0.1:port. A failure to bind is logged and swallowed: the
 * public API must not go down because an auxiliary port is busy.
 */
export function startAdminServer(deps: AdminDeps, port: number, logger: Logger): Promise<http.Server | undefined> {
  return new Promise((resolve) => {
    const server = http.createServer(createAdminApp(deps, logger))
    server.once('error', (error) => {
      logger.error('Could not start the admin server, continuing without it', { error })
      resolve(undefined)
    })
    server.listen(port, '127.0.0.1', () => {
      logger.info(`Admin server is listening on 127.0.0.1:${port} (loopback only)`)
      resolve(server)
    })
  })
}
