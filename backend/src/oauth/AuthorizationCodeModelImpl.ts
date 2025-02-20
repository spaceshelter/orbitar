import crypto, { randomBytes } from 'crypto'

import {
  AuthorizationCode,
  AuthorizationCodeModel,
  Client,
  Falsey,
  RefreshToken,
  RefreshTokenModel,
  Token,
  User,
} from '@node-oauth/oauth2-server'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { RedisClientType } from 'redis'
import { Logger } from 'winston'

import { ExpressOauth2ScopesFilter } from '../api/OAuth2Middleware'
import { OAuthConfig } from '../config'
import OAuth2Repository from '../db/repositories/OAuth2Repository'

enum TokenType {
  Access,
  Refresh,
}

/**
 * AuthorizationCodeModelImpl implements the `AuthorizationCodeModel` interface required by the oauth2-server.
 *
 * See model description here: https://oauth2-server.readthedocs.io/en/latest/model/overview.html
 *
 */
export default class AuthorizationCodeModelImpl implements AuthorizationCodeModel, RefreshTokenModel {
  private repo: OAuth2Repository
  private readonly redis: RedisClientType
  private config: OAuthConfig
  private logger: Logger
  private scopesFilter: ExpressOauth2ScopesFilter

  constructor(
    repo: OAuth2Repository,
    redisClient: RedisClientType,
    oauthScopesFilter: ExpressOauth2ScopesFilter,
    config: OAuthConfig,
    logger: Logger,
  ) {
    this.repo = repo
    this.redis = redisClient
    this.config = config
    this.logger = logger
    this.scopesFilter = oauthScopesFilter
  }

  async getClient(clientId: string, clientSecret?: string): Promise<Falsey | Client> {
    const clientFromDB = await this.repo.getClientByClientId(clientId)
    if (
      !clientFromDB ||
      (clientSecret && clientFromDB.client_secret_hash !== AuthorizationCodeModelImpl.hashString(clientSecret))
    ) {
      return null
    }
    return {
      id: clientId,
      redirectUris: clientFromDB.redirect_uris.split(',').map((uri) => uri.trim()),
      grants: clientFromDB.grants.split(',').map((grant) => grant.trim()),
    }
  }

  async generateAccessToken(client: Client, user: User, scope: string[]): Promise<string> {
    scope = this.scopesFilter.minimizeAndFilterScopes(scope)

    const nowTs = Math.floor(Date.now() / 1000)
    const expiresTs = nowTs + this.config.accessTokenTtlSeconds
    return AuthorizationCodeModelImpl.generateJwtToken(
      {
        sub: user.id.toString(),
        exp: expiresTs,
        iat: nowTs,
        aud: client.id,
        scope,
        type: TokenType.Access,
        user,
      },
      this.logger,
    )
  }

  async getAccessToken(accessToken: string): Promise<Falsey | Token> {
    try {
      const { aud, exp, iat, sub, scope, type, user } = jwt.verify(
        accessToken,
        process.env.JWT_SECRET_KEY,
      ) as JwtPayload

      const clientId = aud.toString()
      const userId = parseInt(sub, 10)

      // Verify token validity (returns Error object on error and grants on success)
      const result = await AuthorizationCodeModelImpl.verifyTokenValidity(
        this.repo,
        type,
        TokenType.Access,
        exp,
        iat,
        clientId,
        userId,
      )
      if (result instanceof Error) {
        return null
      }

      return {
        accessToken,
        accessTokenExpiresAt: new Date(exp * 1000),
        scope,
        client: {
          id: clientId,
          grants: result ? result : [],
        },
        user,
      }
    } catch (error) {
      return null
    }
  }

  async saveToken(token: Token, client: Client, user: User): Promise<Token | Falsey> {
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      client: { id: client.id, grants: client.grants ? client.grants : [] },
      user: { id: user.id },
      scope: token.scope,
    }
  }

  /**
   * scope parameter contains the hierarchical list of scopes:
   *  e.g. for api route '/oauth2/client/register' => [
   *      'oauth2',
   *      'oauth2:client',
   *      'oauth2:client:register'
   *    ]
   *   if **any** of the scopes in the list is present in the token's scope, the function returns true
   */
  async verifyScope(token: Token, scope: string[]): Promise<boolean> {
    const tokenScopes = (token && token.scope) || []
    return scope.some((requiredScope) => tokenScopes.includes(requiredScope))
  }

  async saveAuthorizationCode(code: AuthorizationCode, client: Client, user: User): Promise<AuthorizationCode> {
    const clientId = client.id
    const scope = this.scopesFilter.minimizeAndFilterScopes(code.scope)
    const redirectUri = code.redirectUri
    const expiresAt = new Date((Date.now() / 1000 + this.config.authorizationCodeTtlSeconds) * 1000)

    try {
      // Validate that the client exists via the repository.
      const clientRecord = await this.repo.getClientByClientId(clientId)
      if (!clientRecord) {
        return null
      }

      const authCode = {
        authorizationCode: code.authorizationCode,
        expiresAt,
        redirectUri,
        scope,
        client,
        user,
      }

      await this.redis.set(`oauth2code:${code.authorizationCode}`, JSON.stringify(authCode))
      await this.redis.expire(`oauth2code:${code.authorizationCode}`, this.config.authorizationCodeTtlSeconds)

      return authCode
    } catch (error) {
      return null
    }
  }

  async getAuthorizationCode(code: string): Promise<AuthorizationCode> {
    try {
      const authCodeStr = await this.redis.get(`oauth2code:${code}`)
      if (!authCodeStr) {
        return null
      }

      const authCode: AuthorizationCode = JSON.parse(authCodeStr)
      // Convert expiresAt back to a Date object.
      authCode.expiresAt = new Date(authCode.expiresAt)
      if (authCode.expiresAt < new Date()) {
        await this.revokeAuthorizationCode(authCode)
        return null
      }
      return authCode
    } catch (error) {
      return null
    }
  }

  async revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    try {
      await this.redis.del(`oauth2code:${code.authorizationCode}`)
      return true
    } catch (e) {
      return false
    }
  }

  async generateRefreshToken(client: Client, user: User, scope: string[]): Promise<string> {
    scope = this.scopesFilter.minimizeAndFilterScopes(scope)
    const nowTs = Math.floor(Date.now() / 1000)
    const expiresTs = nowTs + this.config.refreshTokenTtlSeconds
    return AuthorizationCodeModelImpl.generateJwtToken(
      {
        sub: user.id.toString(),
        exp: expiresTs,
        iat: nowTs,
        aud: client.id,
        scope,
        type: TokenType.Refresh,
        user,
      },
      this.logger,
    )
  }

  async getRefreshToken(refreshToken: string): Promise<Falsey | RefreshToken> {
    try {
      const { aud, exp, iat, sub, scope, type, user } = jwt.verify(
        refreshToken,
        process.env.JWT_SECRET_KEY,
      ) as JwtPayload

      const clientId = aud.toString()
      const userId = parseInt(sub, 10)

      // Verify token validity (returns Error object on error and grants on success)
      const result = await AuthorizationCodeModelImpl.verifyTokenValidity(
        this.repo,
        type,
        TokenType.Refresh,
        exp,
        iat,
        clientId,
        userId,
      )
      if (result instanceof Error) {
        return null
      }

      return {
        refreshToken,
        refreshTokenExpiresAt: new Date(exp * 1000),
        scope,
        client: {
          id: clientId,
          grants: result ? result : [],
        },
        user,
      }
    } catch (error) {
      // Error handling: token may be expired or have an invalid signature.
      return null
    }
  }

  async revokeToken(token: RefreshToken | Token): Promise<boolean> {
    // revocation of the individual tokens is not supported
    return true
  }

  async generateAuthorizationCode(client: Client, user: User, scope: string[]): Promise<string> {
    const authCode = randomBytes(32).toString('hex')
    scope = this.scopesFilter.minimizeAndFilterScopes(scope)
    const scopeStr = scope.join(' ')
    await this.repo.saveOrUpdateConsent(client.id, user.id, scopeStr)

    return authCode
  }

  static generateJwtToken(
    params: {
      sub: string
      exp: number
      iat: number
      aud: string
      scope: string[]
      type: TokenType
    } & Record<string, unknown>,
    logger?: Logger,
  ): string {
    if (!process.env.JWT_SECRET_KEY) {
      if (logger) {
        logger.error('empty or not set JWT_SECRET_KEY')
      }
      return null
    }

    const payload = {
      ...params,
      iss: 'https://orbitar.space',
    }

    return jwt.sign(payload, process.env.JWT_SECRET_KEY)
  }

  static generateClientId = (): string => {
    return crypto.randomUUID()
  }

  static generateClientSecret = (): string => {
    return crypto.randomBytes(32).toString('hex')
  }

  static hashString(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }

  static async verifyTokenValidity(
    repo: OAuth2Repository,
    type: TokenType,
    expectedType: TokenType,
    exp: number,
    iat: number,
    clientId: string,
    userId: number,
  ): Promise<Error | string | string[]> {
    // Check that the token type matches the expected type.
    if (type !== expectedType) {
      return new Error('Invalid token type')
    }

    // Check token expiration.
    if (exp && new Date(exp * 1000) < new Date()) {
      return new Error('Token expired')
    }

    // Retrieve the client with consent using the repo.
    const clientWithConsent = await repo.getClientByClientIdWithConsent(clientId, userId)
    if (!clientWithConsent) {
      return new Error('Client not found')
    }

    // Check for token revocation.
    if (clientWithConsent.last_revoked_ts && new Date(iat * 1000) < clientWithConsent.last_revoked_ts) {
      return new Error('Token revoked')
    }

    // All validations pass, return grants
    return clientWithConsent.grants
  }
}
