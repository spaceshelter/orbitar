import { Application, Request, Response, NextFunction } from 'express';
import { AuthenticateOptions } from 'oauth2-server';
import { config } from '../config';
import { ResponseErrorHandler } from './ApiMiddleware';
import Session, { SessionData } from '../session/Session';
import DB from '../db/DB';
import { Logger } from 'winston';

/**
 * OAuth2 authentication middleware.
 *
 * OAuth2 Flow Integration:
 *   - Checks for the presence of an Authorization header.
 *   - Invokes the express‑oauth‑server middleware (configured on the app) to authenticate the request.
 *   - If authentication is successful, the token (containing user information) is available via res.locals.oauth.token.
 *
 * Additional Checks:
 *   - Verifies the token's associated user; for example, it ensures a particular disallowed userId is not allowed.
 *
 * Session Integration:
 *   - When authentication succeeds, the middleware updates session data
 *     via the Session class.
 *
 * @param app Express application instance that has been configured with OAuth2.
 * @param db Database instance (used for sessions persistence).
 * @param logger Logger instance for logging errors and warnings.
 * @returns An Express middleware function that handles OAuth2 authentication.
 */
export default function OAuth2Authenticate(app: Application, db: DB, logger: Logger) {
  return (options: AuthenticateOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Retrieve the authorization header (supports lower or upper case naming)
      const authorizationHeader =
        req.headers['authorization'] || req.headers['Authorization'];

      // If no authorization header is provided, skip OAuth processing and proceed to session middleware.
      if (!authorizationHeader) {
        return next();
      }

      // The express-oauth-server middleware handles the OAuth2 authentication.
      const oauthMiddleware = app.oauth.authenticate(options);
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

      // TODO: Add a check to ensure that consent is granted for the client.

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
