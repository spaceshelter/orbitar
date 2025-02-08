import { AuthorizationCode, AuthorizationCodeModel, Callback, Token, Client, Falsey, User } from 'oauth2-server';
import { randomBytes } from 'crypto';
import OAuth2Repository from '../db/repositories/OAuth2Repository';
import { OAuthConfig } from '../config';
import { RedisClientType } from 'redis';
import { OAuth2ClientRaw } from '../db/types/OAuth2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * TokenType enum indicates whether a token is an Access Token or Refresh Token.
 */
enum TokenType {
  Access,
  Refresh
}

/**
 * AuthorizationCodeModelImpl implements the `AuthorizationCodeModel` interface required by the oauth2-server.
 *
 * See model description here: https://oauth2-server.readthedocs.io/en/latest/model/overview.html
 * 
 * This class encapsulates the logic necessary for an OAuth2 Authorization Code Grant Flow. Key responsibilities
 * include:
 *  - Generating and verifying JWT-based access and refresh tokens.
 *  - Hashing client secrets and other sensitive data using SHA-256.
 *  - Persisting authorization codes in Redis with expiration (TTL) handling.
 *  - Interfacing with a database repository to retrieve and update OAuth2 client and consent information stored in MySQL.
 */
export default class AuthorizationCodeModelImpl implements AuthorizationCodeModel {
  private repo: OAuth2Repository;
  private readonly redis: RedisClientType;
  private config: OAuthConfig;

  constructor(repo: OAuth2Repository, redisClient: RedisClientType, config: OAuthConfig) {
    this.repo = repo;
    this.redis = redisClient;
    this.config = config;
  }

  /**
   * Generates a JWT token for either access or refresh purposes.
   * 
   * @param sub - Subject identifier (typically the user id).
   * @param exp - Expiration timestamp (in seconds).
   * @param iat - Issued-at timestamp.
   * @param aud - Audience, typically the client id.
   * @param scope - The list of permissions (as a string or array of strings).
   * @param type - The type of token (Access or Refresh).
   * @param additionalFields - An object containing any extra payload fields to merge into the token.
   * @returns A signed JWT token string.
   */
  static generateJwtToken(
    sub: string,
    exp: number,
    iat: number,
    aud: string,
    scope: string | string[],
    type: TokenType,
    additionalFields: Record<string, unknown> = {}
  ): string {
    const iss = 'https://orbitar.space';
    scope = Array.isArray(scope) ? scope.join(' ') : scope;
    const payload = {
      aud,
      iss,
      exp,
      iat,
      sub,
      scope,
      type,
      ...additionalFields
    };

    return jwt.sign(payload, process.env.JWT_SECRET_KEY);
  }

  /**
   * Generates SHA-256 hash for a given string.
   * 
   * @param value - The string value to hash.
   * @returns A hex string representing the computed hash.
   */
  hashString(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Retrieves and verifies an access token by decoding its JWT.
   * 
   * OAuth2 Flow Details:
   *   - The JWT is verified using a secret key.
   *   - The function also checks whether the token has expired.
   * 
   * @param accessToken - The JWT string used as the access token.
   * @returns A Token object if verification passes; otherwise, null.
   */
  async getAccessToken(accessToken: string): Promise<Falsey | Token> {
    try {
      // Decode and verify the JWT
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET_KEY) as Token;

      // Ensure the token has not expired.
      if (decoded.accessTokenExpiresAt && new Date(decoded.accessTokenExpiresAt) < new Date()) {
        return null;
      }
      return {
        accessToken,
        accessTokenExpiresAt: new Date(decoded.exp),
        scope: decoded.scope,
        client: decoded.client,
        user: decoded.user
      };
    } catch (error) {
      // Error handling: token may be expired or have an invalid signature.
      return null;
    }
  }

  /**
   * Retrieves the client details from the database repository.
   * 
   * OAuth2 Flow Details:
   *   - When an OAuth2 client is authenticating, its credentials (ID and secret) are validated.
   *   - If the clientSecret is provided, it is hashed and compared with the stored hash.
   * 
   * @param clientId - The unique OAuth2 client identifier.
   * @param clientSecret - Optional plaintext client secret.
   * @returns A Client object conforming to oauth2-server if valid; otherwise, null.
   */
  async getClient(clientId: string, clientSecret?: string): Promise<Falsey | Client> {
    let clientFromDB: OAuth2ClientRaw;
    if (clientSecret) {
      const secretHash = this.hashString(clientSecret);
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

  /**
   * Generates a JWT access token.
   * 
   * OAuth2 Flow Details:
   *   - Access tokens are created with a defined TTL.
   *   - The token includes client and user information within its payload.
   * 
   * @param client - The OAuth2 client for which the token is issued.
   * @param user - The user associated with the token.
   * @param scope - Permissions granted.
   * @returns A signed JWT string representing the access token.
   */
  async generateAccessToken(client: Client, user: User, scope: string | string[]): Promise<string> {
    const nowTs = Math.floor(Date.now() / 1000);
    const expiresTs = nowTs + this.config.accessTokenTtlSeconds;
    return AuthorizationCodeModelImpl.generateJwtToken(
      user.id.toString(),
      expiresTs,
      nowTs,
      client.id,
      scope,
      TokenType.Access,
      {
        client,
        user
      }
    );
  }

  /**
   * Saves an access token and a refresh token once generated.
   * 
   * OAuth2 Flow Details:
   *   - Upon token generation, user consent for the client may also be updated.
   *   - This persists token details for future validation.
   * 
   * @param token - Token object containing access and refresh tokens.
   * @param client - The client associated with the token.
   * @param user - The user for whom the token was generated.
   * @returns The token object if saved successfully; otherwise, null.
   */
  async saveToken(token: Token, client: Client, user: User): Promise<Token | Falsey> {
    const scopeStr = Array.isArray(token.scope) ? token.scope.join(' ') : token.scope;
    await this.repo.saveOrUpdateConsent(user.id, client.id, scopeStr);
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      client: { id: client.id, grants: client.grants ? client.grants : [] },
      user: { id: user.id },
      scope: token.scope,
    };
  }

  /**
   * Verifies that the token has the required scopes.
   * 
   * OAuth2 Flow Details:
   *   - The scopes embedded in the token are compared against required scopes.
   *   - Parent scopes (without colons) can cover child scopes (with colons).
   * 
   * @param token - The token object containing granted scopes.
   * @param scope - The required scope(s), provided as a string or array.
   * @param callback - (Optional) Callback that receives the verification result.
   * @returns True if the token includes the required scope; otherwise, false.
   */
  async verifyScope(token: Token, scope: string | string[], callback?: Callback<boolean>): Promise<boolean> {
    // Convert the token's scopes into an array.
    let tokenScopes: string[] = [];
    if (token && token.scope) {
      if (typeof token.scope === 'string') {
        tokenScopes = token.scope.split(' ').filter((s) => s.trim());
      } else if (Array.isArray(token.scope)) {
        tokenScopes = token.scope;
      }
    }

    // Convert the required scope(s) into an array.
    const requiredScopes = typeof scope === 'string'
      ? scope.split(' ').filter((s) => s.trim())
      : scope;

    const valid = requiredScopes.every(requiredScope => {
      return tokenScopes.some(tokenScope => {
        // Exact match check.
        if (tokenScope === requiredScope) {
          return true;
        }
        // Parent scope covers child scopes: if token has no colon, it covers any scope starting with this token followed by a colon.
        return !tokenScope.includes(':') && requiredScope.startsWith(`${tokenScope}:`);
      });
    });

    if (callback && typeof callback === 'function') {
      callback(null, valid);
    }
    return valid;
  }

  /**
   * Saves an authorization code in Redis with an expiration.
   * 
   * OAuth2 Flow Details:
   *   - Used during the authorization code grant flow.
   *   - Verifies the client exists before storing the code.
   *   - Stores the code along with its expiration, redirect URI, and associated user/client data.
   * 
   * @param code - The authorization code object.
   * @param client - The client associated with this code.
   * @param user - The user who authorized the client.
   * @returns The stored authorization code object if successful; otherwise, null.
   */
  async saveAuthorizationCode(code: AuthorizationCode, client: Client, user: User): Promise<AuthorizationCode> {
    const clientId = client.id;
    const scope = code.scope;
    const redirectUri = code.redirectUri;
    const expiresAt = new Date((Date.now() / 1000 + this.config.authorizationCodeTtlSeconds) * 1000);

    try {
      // Validate that the client exists via the repository.
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

  /**
   * Retrieves an authorization code from Redis.
   * 
   * OAuth2 Flow Details:
   *   - Finds the code in Redis.
   *   - Converts the stored expiration time back into a Date object.
   *   - If the code is expired, it is revoked.
   * 
   * @param code - The authorization code string.
   * @returns The authorization code object if valid; otherwise, null.
   */
  async getAuthorizationCode(code: string): Promise<AuthorizationCode> {
    try {
      const authCodeStr = await this.redis.get(`oauth2code:${code}`);
      if (!authCodeStr) {
        return null;
      }

      const authCode: AuthorizationCode = JSON.parse(authCodeStr);
      // Convert expiresAt back to a Date object.
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

  /**
   * Revokes an authorization code by deleting it from Redis.
   * 
   * OAuth2 Flow Details:
   *   - Once the code is used (or expired), it is removed to prevent reuse.
   * 
   * @param code - The authorization code object to revoke.
   * @returns True if the code was successfully revoked; otherwise, false.
   */
  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    try {
      await this.redis.del(`oauth2code:${code.authorizationCode}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Generates a JWT refresh token.
   * 
   * OAuth2 Flow Details:
   *   - Refresh tokens are used to obtain new access tokens.
   *   - A separate expiration time is configured for refresh tokens.
   * 
   * @param client - The client for which the token is issued.
   * @param user - The user associated with the token.
   * @param scope - The scope granted.
   * @param callback - (Optional) Callback for handling the generated token asynchronously.
   * @returns A signed JWT string representing the refresh token.
   */
  async generateRefreshToken(
    client: Client,
    user: User,
    scope: string | string[],
    callback?: (err: Error | null, refreshToken?: string) => void
  ): Promise<string> {
    const nowTs = Math.floor(Date.now() / 1000);
    const expiresTs = nowTs + this.config.refreshTokenTtlSeconds;
    const token = AuthorizationCodeModelImpl.generateJwtToken(
      user.id.toString(),
      expiresTs,
      nowTs,
      client.id,
      scope,
      TokenType.Refresh,
      {
        client,
        user
      }
    );
    if (callback && typeof callback === 'function') {
      callback(null, token);
    }
    return token;
  }

  /**
   * Generates a secure random authorization code.
   * 
   * OAuth2 Flow Details:
   *   - Used within the authorization code grant flow.
   *   - Generates a random hex string using 32 bytes of randomness.
   * 
   * @param client - The client associated with this request.
   * @param user - The user authorizing the client.
   * @param scope - The granted scope.
   * @param callback - (Optional) Callback for handling the generated code asynchronously.
   * @returns A randomly generated authorization code string.
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

  /**
   * Generates a unique client identifier.
   * 
   * @returns A UUID string.
   */
  static generateClientId = (): string => {
    return crypto.randomUUID();
  };

  /**
   * Generates a secure client secret.
   * 
   * @returns A hexadecimal string representing the new client secret.
   */
  static generateClientSecret = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  /**
   * Computes the SHA-256 hash of a given string.
   * 
   * @param value - The string to hash.
   * @returns The computed hash as a hex string.
   */
  static hashString(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}