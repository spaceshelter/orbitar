import { Application, Request, Response, NextFunction } from 'express';
import { AuthenticateOptions } from 'oauth2-server';
import { config } from '../config';
import { ResponseErrorHandler } from './ApiMiddleware';
import Session, { SessionData } from '../session/Session';
import DB from '../db/DB';
import { Logger } from 'winston';

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
