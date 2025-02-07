import DB from '../DB';
import {
  OAuth2ClientRaw,
  OAuth2ConsentRaw
} from '../types/OAuth2';
import {ResultSetHeader} from 'mysql2';
import TokenService from '../../oauth/TokenService';
import {config} from '../../config';
import {AuthorizationCode, AuthorizationCodeModel, Falsey, Token} from 'oauth2-server';

export default class OAuth2Repository implements AuthorizationCodeModel {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /**
   * Returns the OAuth client (using client_id as the identifier).
   */
  async getClient(clientId: string, clientSecret?: string) {
    let clientFromDB;
    if (clientSecret) {
      const secretHash = TokenService.hashString(clientSecret);
      clientFromDB = await this.getClientByClientIdAndClientSecretHash(clientId, secretHash);
    } else {
      clientFromDB = await this.getClientByClientId(clientId);
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
   * Generates an access token.
   * This method does not persist the token.
   */
  async generateAccessToken(client, user, scope) {
    const nowTs = Math.floor(Date.now() / 1000);
    const accessTokenExpiresAtTs = nowTs + (parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS, 10) || 3600 * 24 * 7);
    return TokenService.generateAccessToken(user.id.toString(), client.id, scope, accessTokenExpiresAtTs, nowTs, nowTs);
  }

  /**
   * Saves a token.
   *
   * Since we don't persist tokens to a database anymore,
   * this implementation simply returns a token object.
   */
  async saveToken(token, client, user): Promise<Token | Falsey> {
    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      client: {
        id: client.id,
        grants: client.grants ? client.grants : [],
      },
      user: {
        id: user.id,
      },
      scope: token.scope,
    };
  }

  /**
   * Retrieves an access token.
   *
   * Since tokens are not stored, we always return null.
   */
  async getAccessToken(accessToken: string): Promise<Token | Falsey> {
    return null;
  }

  /**
   * Retrieves a refresh token.
   *
   * Since tokens are not stored, we always return null.
   */
  async getRefreshToken(refreshToken: string): Promise<Token | Falsey> {
    return null;
  }

  /**
   * Revokes a token.
   *
   * As tokens are not persisted, nothing needs to be revoked.
   */
  async revokeToken(token): Promise<boolean> {
    return true;
  }

  /**
   * Verifies token scope.
   *
   * With token persistence removed, this method can't perform any real verification.
   * Adjust this implementation as needed.
   */
  async verifyScope(accessToken, requestedScopes): Promise<boolean> {
    return false;
  }

  /**
   * Saves an authorization code.
   */
  private static authorizationCodes = new Map<string, {
    code: AuthorizationCode;
    expiresAt: Date;
  }>();

  async saveAuthorizationCode(code, client, user) {
    const userId = user.id;
    const clientId = client.id;
    const scope = code.scope;
    const redirectUri = code.redirectUri;

    const expiresAt = new Date((Date.now() / 1000 + config.oauth.authorizationCodeTtlSeconds) * 1000);

    try {
      // Check if the client exists
      const clientRecord = await this.getClientByClientId(clientId);
      if (!clientRecord) {
        return null;
      }

      // Save consent
      await this.db.query(
        `insert into oauth_consents (user_id, client_id, scope)
         values (:user_id, :client_id, :scope)
         on duplicate key update scope=:scope`,
        {
          user_id: userId,
          client_id: clientId,
          scope,
        }
      );

      // Store the code in memory
      const authCode = {
        authorizationCode: code.authorizationCode,
        expiresAt,
        redirectUri,
        scope,
        client,
        user,
      };
      
      OAuth2Repository.authorizationCodes.set(code.authorizationCode, {
        code: authCode,
        expiresAt
      });

      // Clean up expired codes
      this.cleanupExpiredCodes();

      return authCode;
    } catch (error) {
      return null;
    }
  }

  private cleanupExpiredCodes() {
    const now = new Date();
    for (const [hash, data] of OAuth2Repository.authorizationCodes) {
      if (data.expiresAt < now) {
        OAuth2Repository.authorizationCodes.delete(hash);
      }
    }
  }

  /**
   * Retrieves an authorization code (ensuring it is not expired).
   */
  async getAuthorizationCode(code: string): Promise<AuthorizationCode | Falsey> {
    const authCode = OAuth2Repository.authorizationCodes.get(code);
    if (!authCode || authCode.expiresAt < new Date()) {
      return null;
    }
    return authCode.code;
  }

  /**
   * Revokes an authorization code.
   */
  async revokeAuthorizationCode(code): Promise<boolean> {
    try {
      OAuth2Repository.authorizationCodes.delete(code.authorizationCode);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retrieves a client by its client_id.
   */
  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      'select * from oauth_clients where client_id = :client_id',
      { client_id: clientId }
    );
  }

  /**
   * Retrieves a client by its client_id and client secret hash.
   */
  async getClientByClientIdAndClientSecretHash(clientId: string, clientSecretHash: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      'select * from oauth_clients where client_id = :client_id and client_secret_hash = :client_secret_hash',
      {
        client_id: clientId,
        client_secret_hash: clientSecretHash,
      }
    );
  }

  /**
   * Retrieves a list of clients (with consent info) for a given user.
   */
  async getClients(userId: number): Promise<OAuth2ClientRaw[]> {
    return await this.db.fetchAll<OAuth2ClientRaw>(
      `select 
          oauth_clients.*,
          oauth_consents.user_id as is_authorized,
          if(oauth_clients.user_id = :user_id, 1, 0) as is_my
        from 
          oauth_clients 
        left outer join oauth_consents on oauth_consents.user_id = :user_id and oauth_consents.client_id = oauth_clients.client_id
        where 
          oauth_clients.user_id = :user_id or
          oauth_consents.user_id is not null`,
      { user_id: userId }
    );
  }

  /**
   * Creates a new OAuth client.
   */
  async createClient(
    name: string,
    description: string,
    logoUrl: string,
    initialAuthorizationUrl: string,
    clientId: string,
    clientSecretHash: string,
    redirectUris: string,
    userId: number
  ): Promise<OAuth2ClientRaw> {
    await this.db.query(
      `
      INSERT INTO oauth_clients 
        (name, description, logo_url, client_id, client_secret_hash, initial_authorization_url, redirect_uris, user_id, grants)
      VALUES 
        (:name, :description, :logo_url, :client_id, :client_secret_hash, :initial_authorization_url, :redirect_uris, :user_id, :grants)
      `,
      {
        name,
        description,
        logo_url: logoUrl,
        client_id: clientId,
        client_secret_hash: clientSecretHash,
        initial_authorization_url: initialAuthorizationUrl,
        redirect_uris: redirectUris,
        user_id: userId,
        grants: 'authorization_code,refresh_token'
      }
    );

    return {
      name,
      description,
      logo_url: logoUrl,
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      initial_authorization_url: initialAuthorizationUrl,
      redirect_uris: redirectUris,
      user_id: userId,
      grants: 'authorization_code,refresh_token'
    } as OAuth2ClientRaw;
  }

  /**
   * Updates the client secret.
   */
  async updateClientSecret(newSecretHash: string, clientId: string, userId: number): Promise<boolean> {
    return await this.db.query<ResultSetHeader>(
      'update oauth_clients set client_secret_hash = :new_secret_hash where client_id = :client_id and user_id = :user_id',
      {
        new_secret_hash: newSecretHash,
        client_id: clientId,
        user_id: userId,
      }
    ).then(result => result.affectedRows > 0);
  }

  /**
   * Deletes an OAuth client.
   */
  async deleteClient(clientId: string, authorId: number): Promise<boolean> {
    return this.db.query<ResultSetHeader>(
      'delete from oauth_clients where client_id = :client_id and user_id = :user_id',
      {
        client_id: clientId,
        user_id: authorId,
      }
    ).then(result => result.affectedRows > 0);
  }

  /**
   * Removes consent for an OAuth client.
   */
  async unAuthorizeClient(clientId: string, userId: number): Promise<boolean> {
    await this.db.query(
      'delete from oauth_consents where client_id=:client_id and user_id=:user_id',
      {
        client_id: clientId,
        user_id: userId,
      }
    );
    return true;
  }

  /**
   * Updates the logo URL for an OAuth client.
   */
  async updateClientLogoUrl(clientId: string, userId: number, url: string): Promise<boolean> {
    return await this.db.query<ResultSetHeader>(
      'update oauth_clients set logo_url=:url where client_id=:client_id and user_id=:user_id',
      {
        url,
        client_id: clientId,
        user_id: userId,
      }
    ).then(result => result.affectedRows > 0);
  }
}
