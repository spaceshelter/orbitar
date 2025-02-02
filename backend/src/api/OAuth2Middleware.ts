import {AuthenticateOptions} from 'oauth2-server';
import { config } from '../config';
import { ResponseErrorHandler } from './ApiMiddleware';
import Session, {SessionData} from '../session/Session';

export default function OAuth2Authenticate(app, db, logger) {
  return (options: AuthenticateOptions) => {
    return async (req, res, next) => {
      const authorizationHeader = req.headers['authorization'] || req.headers['Authorization'];

      // If no authorization header, proceed to the next middleware that checks cookie-based session
      if (!authorizationHeader) {
        return next();
      }

      try {
        await app.oauth.authenticate(options)(req, res, () => {});
        const userId = res.locals.oauth.token.user.id;
        if (config.barmalini.userId === userId) {
          return new ResponseErrorHandler('500', 'Something went wrong', undefined, res);
        }

        req.session = new Session(db, logger, req, res);
        req.session.data = new SessionData('', userId);

        return next();
      } catch (error) {
        logger.error(`Failed OAuth access attempt: ${error || 'authentication error'}`);
      }
    };
  };
}
