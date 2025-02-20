import { AuthenticateOptions } from '@node-oauth/oauth2-server'
import { Application, NextFunction, Request, Response } from 'express'
import { Logger } from 'winston'

import { config } from '../config'
import DB from '../db/DB'
import Session, { SessionData } from '../session/Session'
import { ResponseErrorHandler } from './ApiMiddleware'
import extractFromExpressApp from './utils/express-reflection'

/**
 * Creates an OAuth2 middleware generator.
 *
 * This function initializes a middleware generator by accepting the application instance,
 * database, and logger. It returns a middleware generator function that controllers can use
 * to create endpoint-specific OAuth2 middleware by passing the appropriate authentication options.
 *
 * @param app - The Express application instance.
 * @param db - The database instance.
 * @param logger - The logger instance for error and debug logging.
 * @returns A middleware generator function for creating OAuth2 middleware.
 */
export default function createOauth2MiddlewareGenerator(
  app: Application,
  db: DB,
  logger: Logger,
): OAuth2MiddlewareGenerator {
  /**
   * Middleware Generator Function.
   *
   * This function accepts OAuth2 authentication options and returns an Express middleware
   * function specific to the endpoint. The middleware that it creates will validate the OAuth2
   * token and initialize session data as needed.
   *
   * @param options - The OAuth2 authentication configuration options.
   * @returns An Express middleware function for OAuth2 authentication.
   */
  return (scopeDescription?: string) => {
    let options: AuthenticateOptions | undefined = undefined

    const lazyGetOptions = (req: Request) => {
      if (options === undefined) {
        options = {
          scope: ExpressOauth2ScopesFilter.pathToScopesList(req.route.path),
        }
      }
      return options
    }

    /**
     * Express Middleware for OAuth2 Authentication.
     *
     * This asynchronous middleware function performs the following steps:
     * 1. Retrieves the authorization header from the incoming request (supports case-insensitive lookup).
     * 2. If an authorization header is present, it uses the configured OAuth2 server middleware to
     *    validate the token.
     * 3. If authentication fails, an error response is sent using the ResponseErrorHandler.
     * 4. If authentication succeeds, it checks that the token contains the required data and,
     *    if valid, initializes (or updates) the session with the authenticated user's information.
     * 5. Finally, the middleware calls the next handler in the Express pipeline.
     *
     * @param req - The Express Request object.
     * @param res - The Express Response object.
     * @param next - The callback function to pass control to the next middleware.
     * @returns A Promise that resolves to either void or a ResponseErrorHandler instance in case of an error.
     */
    const res = async (req: Request, res: Response, next: NextFunction) => {
      // Retrieve the authorization header (supports lower or upper case naming)
      const authorizationHeader = req.headers['authorization'] || req.headers['Authorization']

      // If no authorization header is provided, skip OAuth processing and proceed to session middleware.
      if (!authorizationHeader) {
        return next()
      }

      // The express-oauth-server middleware handles the OAuth2 authentication.
      const oauthMiddleware = app.oauth.authenticate(lazyGetOptions(req))
      try {
        await new Promise<void>((resolve, reject) => {
          oauthMiddleware(req, res, (err: Error | string | undefined) => {
            if (err) {
              return reject(err)
            }
            resolve()
          })
        })
      } catch (err) {
        logger.error(`Failed OAuth access attempt: ${err || 'authentication error'}`)
        return new ResponseErrorHandler('500', 'Internal Server Error', undefined, res)
      }

      // Ensure the OAuth middleware placed the token on res.locals.
      const token = res.locals.oauth && res.locals.oauth.token
      if (!token) {
        logger.warn('Token is undefined after authentication.')
        return next()
      }

      // Additional check: In this example, a particular user id is not allowed.
      const userId = token.user && token.user.id
      if (config.barmalini.userId === userId) {
        return new ResponseErrorHandler('500', 'Something went wrong', undefined, res)
      }

      // Initialize or update session data with the authenticated user.
      req.session = new Session(db, logger, req, res)
      req.session.data = new SessionData('', userId)

      return next()
    }

    res.orbitarOauth2ScopeDescription = scopeDescription
    return res
  }
}

export type OAuth2Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void | ResponseErrorHandler>

export type OAuth2MiddlewareGenerator = (scopeDescription: string) => OAuth2Middleware

export class ExpressOauth2ScopesFilter {
  private readonly app: Application

  // lazy load the scopes from the Express app
  private paths: Record<string, string> | undefined = undefined
  private allScopes: string[] | undefined = undefined
  private allScopesSet: Set<string> | undefined = undefined
  private allLeafScopes: string[] | undefined = undefined
  private scopesToDescriptions: Record<string, string> | undefined = undefined

  constructor(app: Application) {
    this.app = app
  }

  /**
   * Collects the paths from the Express app as defined by the `OAuth2MiddlewareGenerator` with the given scope description.
   */
  getPaths() {
    if (this.paths === undefined) {
      // Extract the scopes from the Express app
      const scopeLocations = extractFromExpressApp<string>(this.app, 'orbitarOauth2ScopeDescription')
      this.paths = scopeLocations.reduce((acc, [path, value]) => {
        if (value) {
          acc[path] = value
          return acc
        }
      }, {})
    }
    return this.paths
  }

  /**
   * Returns expanded list of all scopes corresponding to app routes.
   * The scopes are generated by nesting the path chunks with ':'.
   * e.g. '/oauth2/client/register' => [
   *    'oauth2',
   *    'oauth2:client',
   *    'oauth2:client:register'
   *    ]
   */
  getAllScopes() {
    if (this.allScopes === undefined) {
      this.allScopes = Array.from(
        new Set(
          Object.keys(this.getPaths()).reduce((acc, path) => {
            acc.push(...ExpressOauth2ScopesFilter.pathToScopesList(path))
            return acc
          }, []),
        ),
      )
    }
    return this.allScopes
  }

  getAllScopesSet() {
    if (this.allScopesSet === undefined) {
      this.allScopesSet = new Set(this.getAllScopes())
    }
    return this.allScopesSet
  }

  getAllLeafScopes() {
    if (this.allLeafScopes === undefined) {
      this.allLeafScopes = Object.keys(this.getPaths()).map((path) => ExpressOauth2ScopesFilter.pathToScope(path))
    }
    return this.allLeafScopes
  }

  getScopesToDescriptions() {
    if (this.scopesToDescriptions === undefined) {
      this.scopesToDescriptions = Object.keys(this.getPaths()).reduce((acc, path) => {
        acc[ExpressOauth2ScopesFilter.pathToScope(path)] = this.getPaths()[path]
        return acc
      }, {})
    }
    return this.scopesToDescriptions
  }

  /**
   * Resolves the given scopes to the most specific scopes corresponding to app routes.
   * @param scopes
   */
  resolveScopes(scopes: string[]) {
    return this.getAllLeafScopes().filter((scope) =>
      scopes.some((superscope) => ExpressOauth2ScopesFilter.isSubscope(scope, superscope)),
    )
  }

  mapScopesToDescriptions(scopes: string[]) {
    return scopes.reduce((acc, scope) => {
      acc[scope] = this.getScopesToDescriptions()[scope]
      return acc
    }, {})
  }

  /**
   * Filters the given scopes to only include the ones that are defined in the app routes.
   */
  filterScopes(arr: string[]) {
    return arr.filter((scope) => this.getAllScopesSet().has(scope))
  }

  minimizeAndFilterScopes(arr: string[]) {
    return ExpressOauth2ScopesFilter.minimizeScopes(this.filterScopes(arr))
  }

  static isSubscope(subscope: string, superscope: string) {
    return (
      subscope === superscope ||
      (subscope.length > superscope.length && subscope[superscope.length] === ':' && subscope.startsWith(superscope))
    )
  }

  static splitScope(scope: string) {
    return scope
      .split(' ')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  /**
   * Minimizes the given scopes by removing specific scopes that are already included in the more general scopes.
   */
  static minimizeScopes(arr: string[]) {
    return arr.filter(
      (scope) =>
        scope.indexOf(':') === -1 || !arr.some((superscope) => ExpressOauth2ScopesFilter.isSubscope(superscope, scope)),
    )
  }

  static pathToScope(path: string) {
    // split path by '/' and generate the scope by nesting the path chunks with ':'
    // e.g. '/oauth2/client/register' => 'oauth2:client:register'
    return path.split('/').slice(1).join(':')
  }

  static pathToScopesList(path: string) {
    // split path by '/' and generate the scope by nesting the path chunks with ':'
    // e.g. '/oauth2/client/register' => [
    //     'oauth2',
    //     'oauth2:client',
    //     'oauth2:client:register'
    //   ]
    return path
      .split('/')
      .slice(1)
      .reduce((acc, chunk) => {
        chunk = chunk.trim()
        acc.push(acc.length > 0 ? `${acc[acc.length - 1]}:${chunk}` : chunk)
        return acc
      }, [])
  }
}
