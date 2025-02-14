import { Application, Request, Response, NextFunction } from 'express';
import { AuthenticateOptions } from 'oauth2-server';
import { config } from '../config';
import { ResponseErrorHandler } from './ApiMiddleware';
import Session, { SessionData } from '../session/Session';
import DB from '../db/DB';
import { Logger } from 'winston';

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
export default function createOauth2MiddlewareGenerator(app: Application, db: DB, logger: Logger): OAuth2MiddlewareGenerator {
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
  return () => {
    let options: AuthenticateOptions | undefined = undefined;

    const lazyGetOptions = (req: Request) => {
      if (options === undefined) {
        const path = req.route.path;
        // split path by '/' and generate the scope by nesting the path chunks with ':'
        // e.g. '/oauth2/client/register' => [
        //     'oauth2',
        //     'oauth2:client',
        //     'oauth2:client:register'
        //   ]
        const scopes = path.split('/').slice(1).reduce((acc, chunk) => {
          chunk = chunk.trim();
          acc.push(acc.length > 0 ? `${acc[acc.length - 1]}:${chunk}` : chunk);
          return acc;
        }, []);
        options = {
          scope: scopes
        };
      }
      return options;
    };


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
    return async (req: Request, res: Response, next: NextFunction) => {
      // Retrieve the authorization header (supports lower or upper case naming)
      const authorizationHeader =
        req.headers['authorization'] || req.headers['Authorization'];

      // If no authorization header is provided, skip OAuth processing and proceed to session middleware.
      if (!authorizationHeader) {
        return next();
      }

      // The express-oauth-server middleware handles the OAuth2 authentication.
      const oauthMiddleware = app.oauth.authenticate(lazyGetOptions(req));
      try {
        await new Promise<void>((resolve, reject) => {
          oauthMiddleware(req, res, (err: Error | string | undefined) => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
      } catch (err) {
        logger.error(`Failed OAuth access attempt: ${err || 'authentication error'}`);
        return new ResponseErrorHandler('500', 'Internal Server Error', undefined, res);
      }

      // Ensure the OAuth middleware placed the token on res.locals.
      const token = res.locals.oauth && res.locals.oauth.token;
      if (!token) {
        logger.warn('Token is undefined after authentication.');
        return next();
      }

      // Additional check: In this example, a particular user id is not allowed.
      const userId = token.user && token.user.id;
      if (config.barmalini.userId === userId) {
        return new ResponseErrorHandler('500', 'Something went wrong', undefined, res);
      }

      // Initialize or update session data with the authenticated user.
      req.session = new Session(db, logger, req, res);
      req.session.data = new SessionData('', userId);

      return next();
    };
  };
}

export type OAuth2Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void | ResponseErrorHandler>;

export type OAuth2MiddlewareGenerator = () => OAuth2Middleware;
