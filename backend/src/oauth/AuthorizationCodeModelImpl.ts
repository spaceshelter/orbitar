import { AuthorizationCode, AuthorizationCodeModel, Callback, Token, Client, Falsey, User } from 'oauth2-server';
import { randomBytes } from 'crypto';
import OAuth2Repository from '../db/repositories/OAuth2Repository';
import TokenService, { TokenType } from './TokenService';
import { OAuthConfig } from '../config';
import { RedisClientType } from 'redis';
import { OAuth2ClientRaw } from '../db/types/OAuth2';

export default class AuthorizationCodeModelImpl implements AuthorizationCodeModel {
  private repo: OAuth2Repository;
  private readonly redis: RedisClientType;
  private config: OAuthConfig;

  // In-memory storage for authorization codes
  private readonly authorizationCodes: Map<string, { code: AuthorizationCode; expiresAt: Date }>;

  constructor(repo: OAuth2Repository, redisClient: RedisClientType, config: OAuthConfig) {
    this.repo = repo;
    this.redis = redisClient;
    this.config = config;
  }

  async getAccessToken(accessToken: string, callback?: Callback<Token>): Promise<Falsey | Token> {
    // Implement token lookup logic if needed.
    return null;
  }

  async getClient(clientId: string, clientSecret?: string): Promise<Falsey | Client> {
    let clientFromDB: OAuth2ClientRaw;
    if (clientSecret) {
      const secretHash = TokenService.hashString(clientSecret);
      clientFromDB = await this.repo.getClientByClientIdAndClientSecretHash(clientId, secretHash);
    } else {
      clientFromDB = await this.repo.getClientByClientId(clientId);
    }

    if (!clientFromDB) {
      return null;
    }

    return {
      id: clientId,
      redirectUris: clientFromDB.redirect_uris.split(',').map(uri => uri.trim()),
      grants: clientFromDB.grants.split(',').map(grant => grant.trim()),
    };
  }

  async generateAccessToken(client: Client, user: User, scope: string | string[]): Promise<string> {
    const nowTs = Math.floor(Date.now() / 1000);
    const expiresTs = nowTs + this.config.accessTokenTtlSeconds;
    return TokenService.generateJwtToken(
      user.id.toString(),
      expiresTs,
      nowTs,
      client.id,
      scope,
      TokenType.Access
    );
  }

  async saveToken(token: Token, client: Client, user: User): Promise<Token | Falsey> {
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      client: {
        id: client.id,
        grants: client.grants ? client.grants : []
      },
      user: {
        id: user.id,
      },
      scope: token.scope,
    };
  }

  async verifyScope(token: Token, scope: string | string[], callback?: Callback<boolean>): Promise<boolean> {
    const tokenScopes = Array.isArray(token.scope) ? token.scope : (token.scope ? token.scope.split(' ') : []);
    const requestedScopes = Array.isArray(scope) ? scope : scope.split(' ');
    const valid = requestedScopes.every(s => tokenScopes.includes(s));
    if (callback) {
      callback(null, valid);
    }
    return valid;
  }

  /**
   * Saves an authorization code.
   * Ensures that the client exists via the associated repository.
   */
  async saveAuthorizationCode(code, client, user): Promise<AuthorizationCode> {
    const clientId = client.id;
    const scope = code.scope;
    const redirectUri = code.redirectUri;
    const expiresAt = new Date((Date.now() / 1000 + this.config.authorizationCodeTtlSeconds) * 1000);

    try {
      // Validate client existence using the repository.
      const clientRecord = await this.repo.getClientByClientId(clientId);
      if (!clientRecord) {
        return null;
      }

      const authCode = {
        authorizationCode: code.authorizationCode,
        expiresAt,
        redirectUri,
        scope,
        client,
        user,
      };

      await this.redis.set(`oauth2code:${code.authorizationCode}`, JSON.stringify(authCode));
      await this.redis.expire(`oauth2code:${code.authorizationCode}`, this.config.authorizationCodeTtlSeconds);

      return authCode;
    } catch (error) {
      return null;
    }
  }

  async getAuthorizationCode(code: string): Promise<AuthorizationCode> {
    try {
      const authCodeStr = await this.redis.get(`oauth2code:${code}`);
      if (!authCodeStr) {
        return null;
      }

      const authCode: AuthorizationCode = JSON.parse(authCodeStr);

      // Convert expiresAt back to a Date object
      authCode.expiresAt = new Date(authCode.expiresAt);

      if (authCode.expiresAt < new Date()) {
        await this.revokeAuthorizationCode(authCode);
        return null;
      }
      return authCode;
    } catch (error) {
      return null;
    }
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    try {
      await this.redis.del(`oauth2code:${code.authorizationCode}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async generateRefreshToken(
    client: Client,
    user: User,
    scope: string | string[],
    callback?: (err: Error | null, refreshToken?: string) => void
  ): Promise<string> {
    const nowTs = Math.floor(Date.now() / 1000);
    const expiresTs = nowTs + this.config.refreshTokenTtlSeconds;
    const token = TokenService.generateJwtToken(
      user.id.toString(),
      expiresTs,
      nowTs,
      client.id,
      scope,
      TokenType.Refresh
    );
    if (callback && typeof callback === 'function') {
      callback(null, token);
    }
    return token;
  }

  /**
   * Generates a secure random authorization code.
   * Uses Node's crypto module instead of a JWT (which is redundant).
   */
  async generateAuthorizationCode(
    client: Client,
    user: User,
    scope: string | string[],
    callback?: (err: Error | null, authorizationCode?: string) => void
  ): Promise<string> {
    const authCode = randomBytes(32).toString('hex');
    if (callback && typeof callback === 'function') {
      callback(null, authCode);
    }
    return authCode;
  }
} 