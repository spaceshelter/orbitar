import DB from '../db/DB';
import { Logger } from 'winston';
import { RequestHandler } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import TokenService from '../oauth/TokenService';
import { config } from '../config';
import Session, { SessionData, SessionType } from '../session/Session';
import { ResponseErrorHandler } from './ApiMiddleware';
import OAuth2Manager from '../managers/OAuth2Manager';
import crypto from 'crypto';
import { OAuth2RefreshTokenCheckResult } from '../db/types/OAuth2';
import { checkOAuthAccess } from './utils/OAuth2-scopes-map';

/**
 * OAuth2 middleware
 *
 * This middleware depends on `express.urlencoded` middleware
 * It checks for the presence of `Authorization` header in the incoming request and validates it accordingly.
 *
 * Requests with Access token should have this header:
 * `Authorization: Bearer <access_token>`
 *
 * Requests with Refresh token should have this header:
 * `Authorization: Basic <base64(client_id:sha256(client_secret))>`
 *
 * Refresh token should be able only to refresh access token, so it should not be used for any other requests.
 *
 * If no token is provided, it calls next() to pass control to the session middleware.
 *
 **/

export default function OAuth2Middleware(db: DB, logger: Logger, oauth2Manager: OAuth2Manager): RequestHandler {
  return async (req, res, next) => {

    // check if authorization header is present, if not, pass to session middleware
    const authHeaderAccessToken = req.get('Authorization');
    if (!authHeaderAccessToken) {
      return next();
    }

    // Detect token type
    const [tokenType, token] = authHeaderAccessToken.split(' ');
    if (tokenType && !['Basic', 'Bearer'].includes(tokenType)) {
      logger.info('Authorization header was sent with invalid token type', { tokenType });
      return new ResponseErrorHandler('401', 'Authorization header was sent with invalid token type', undefined, res);
    }

    if (tokenType && !token) {
      logger.info('Authorization header was sent with no token', { authHeader: authHeaderAccessToken });
      return new ResponseErrorHandler('401', 'Authorization header was sent with no token', undefined, res);
    }

    // Basic token (refresh token)
    if (tokenType === 'Basic') {
      const [clientId, clientSecretHash] = Buffer.from(token, 'base64').toString('utf-8').split(':');
      if (!clientId || !clientSecretHash) {
        logger.info('Authorization header has no client id or secret provided', { authHeader: authHeaderAccessToken });
        return new ResponseErrorHandler('401', 'Authorization header has no client id or secret provided', undefined, res);
      }

      // get refresh token hash from body
      const { grant_type, refresh_token } = req.body;
      if (
        !grant_type || !refresh_token ||
        grant_type !== 'refresh_token'
      ) {
        logger.info('Invalid payload', { grant_type, refresh_token });
        return new ResponseErrorHandler('401', 'Invalid payload', undefined, res);
      }
      try {
        const refreshTokenCheckResult: OAuth2RefreshTokenCheckResult = await oauth2Manager.checkRefreshTokenHash(refresh_token, clientId, clientSecretHash);
        if (!refreshTokenCheckResult) {
          return new ResponseErrorHandler('401', 'Failed to verify grant', undefined, res);
        }
        const scopes = refreshTokenCheckResult.scope.split(',').map((s) => s.trim());
        req.session = new Session(db, logger, req, res, SessionType.OAuth2RefreshToken, scopes);
        req.session.data = new SessionData('', refreshTokenCheckResult.userId);
        return next();
      } catch (err) {
        logger.error('Refresh token is invalid', { error: err, token });
        return new ResponseErrorHandler('401', 'Refresh token is invalid: '  + err?.message, undefined, res);
      }
    }

    // Bearer token (access token)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isRevoked = oauth2Manager.isTokenRevoked(tokenHash);
    if (isRevoked) {
      logger.info('Token revoked', { tokenHash });
      return new ResponseErrorHandler('401', 'Token revoked', undefined, res);
    }

    let decoded: JwtPayload;
    let scopes: string[];
    try {
      decoded = jwt.verify(token, TokenService.getSecretKey()) as JwtPayload;
      scopes = decoded.scope.split(',').map((s) => s.trim());
    } catch (err) {
      logger.error('Authorization token is invalid', { error: err, token });
      return new ResponseErrorHandler('401', 'Authorization token is invalid: '  + err?.message, undefined, res);
    }

    if (decoded.exp < Date.now() / 1000) {
      logger.error('Authorization token expired', { decoded });
      return new ResponseErrorHandler('401', 'Authorization token expired', undefined, res);
    }

    const username = decoded.name;
    const userId = parseInt(decoded.sub, 10);

    if (config.barmalini.userId === userId) {
      logger.info('Barmalini attempt, ignore', { username, userId });
      return new ResponseErrorHandler('500', 'Something went wrong', undefined, res);
    }

    if (!checkOAuthAccess(req.url, scopes)) {
      logger.info('Access denied', { url: req.url, username, userId, scopes });
      return new ResponseErrorHandler('403', 'Access denied', undefined, res);
    }

    req.session = new Session(db, logger, req, res, SessionType.OAuth2Token, scopes);
    req.session.data = new SessionData('', userId);
    next();
  };
}
