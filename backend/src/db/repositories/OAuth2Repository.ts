import DB from '../DB';
import {
  OAuth2AuthorizationCodeRaw,
  OAuth2ClientRaw,
  OAuth2ConsentRaw,
  OAuth2ServerAccessToken,
  OAuth2TokenRaw
} from '../types/OAuth2';
import {ResultSetHeader} from 'mysql2';
import TokenService from '../../oauth/TokenService';
import {config} from '../../config';

export default class OAuth2Repository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /**
   * node-oauth2-server model methods
   * https://node-oauthoauth2-server.readthedocs.io/en/master/model/spec.html
   * **/
  async getClient(clientId: string, clientSecret: string) {
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

  async generateAccessToken(client, user, scope) {
    const nowTs = Math.floor(Date.now() / 1000);
    const accessTokenExpiresAtTs = nowTs + (parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS, 10) || 3600 * 24 * 7);

    return TokenService.generateAccessToken(user.id.toString(), client.id, scope, accessTokenExpiresAtTs, nowTs, nowTs);
  }

  async saveToken(token, client, user) {
    let clientId, userId;
    if (token.authorizationCode) {
      const authorizationCodeFromDb = await this.getAuthorizationCode(token.authorizationCode, true);
      clientId = authorizationCodeFromDb.client.numeric_id;
      userId = authorizationCodeFromDb.user.id;
    } else {
      const clientData = await this.getClientByClientId(client.id);
      clientId = clientData.id;
      userId = user.id;
    }

    await this.db.query('insert into oauth_tokens (access_token_hash, access_token_expires_at, refresh_token_hash, client_id, user_id, scope) values (:access_token_hash, :access_token_expires_at, :refresh_token_hash, :client_id, :user_id, :scope)', {
      access_token_hash: TokenService.hashString(token.accessToken),
      access_token_expires_at: token.accessTokenExpiresAt,
      refresh_token_hash: TokenService.hashString(token.refreshToken),
      client_id: clientId,
      user_id: userId,
      scope: token.scope
    });

    return {
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      client: {
        id: clientId
      },
      user: {
        id: userId
      }
    };
  }

  async getAccessToken(accessToken: string): Promise<OAuth2ServerAccessToken> {
    const tokenFromDb = await this.getTokenByAccessTokenHash(TokenService.hashString(accessToken));
    if (!tokenFromDb) {
      return null;
    }
    return {
      accessToken,
      accessTokenExpiresAt: new Date(tokenFromDb.access_token_expires_at),
      scope: tokenFromDb.scope?.split(','),
      client: {
        id: tokenFromDb.client_client_id
      },
      user: {
        id: tokenFromDb.user_id
      }
    };
  }

  async saveAuthorizationCode(code, client, user) {
    const userId = user.id;
    const clientId = client.id;
    const scope = code.scope;
    const redirectUri = code.redirectUri;

    const authorizationCodeHash = TokenService.hashString(code.authorizationCode);
    const expiresAt = new Date((Date.now() / 1000 + config.oauth.authorizationCodeTtlSeconds) * 1000);

    try {
      const clientRaw = await this.getClientByClientId(clientId);
      const clientNumericId = clientRaw.id;

      await this.db.inTransaction(async (db) => {
        // save consent
        await this.db.query('insert into oauth_consents (user_id, client_id, scope) values (:user_id, :client_id, :scope) on duplicate key update scope=:scope', {
          user_id: userId,
          client_id: clientNumericId,
          scope
        });

        // clear old codes
        await db.query('delete from oauth_codes where client_id=:client_id and user_id=:user_id', {
          client_id: clientNumericId,
          user_id: userId
        });

        // save code
        await db.insert('oauth_codes', {
          client_id: clientNumericId,
          user_id: userId,
          code_hash: authorizationCodeHash,
          expires_at: expiresAt,
          redirect_uri: redirectUri,
          scope
        });
      });
    } catch (error) {
      return null;
    }

    return {
      authorizationCode: code.authorizationCode,
      expiresAt: expiresAt,
      redirectUri: redirectUri,
      scope,
      client,
      user
    };
  }

  async getAuthorizationCode(code: string, getExpired = false) {
    const codeHash = TokenService.hashString(code);
    const codeFromDb = await this.db.fetchOne<OAuth2AuthorizationCodeRaw>(`select oc.*, ocl.client_id as client_client_id from oauth_codes oc, oauth_clients ocl where oc.code_hash = :code_hash and ocl.id = oc.client_id`, {
      code_hash: codeHash
    });

    if (!getExpired && codeFromDb.expires_at < new Date()) {
      return null;
    }

    return {
      authorizationCode: code,
      expiresAt: codeFromDb.expires_at,
      redirectUri: codeFromDb.redirect_uri,
      scope: codeFromDb.scope,
      client: {
        id: codeFromDb.client_client_id,
        numeric_id: codeFromDb.client_id
      },
      user: {
        id: codeFromDb.user_id
      }
    };
  }

  async revokeAuthorizationCode(code) {
    try {
      await this.db.query('update oauth_codes set expires_at = now() - 1 where code_hash=:code_hash', {
        code_hash: TokenService.hashString(code.authorizationCode)
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getRefreshToken(refreshToken) {
    const tokenFromDb = await this.getTokenByRefreshTokenHash(TokenService.hashString(refreshToken));
    if (!tokenFromDb) {
      return null;
    }
    return {
      refreshToken,
      scope: tokenFromDb.scope,
      revoked: tokenFromDb.revoked,
      client: {
        id: tokenFromDb.client_client_id
      },
      user: {
        id: tokenFromDb.user_id
      }
    };
  }

  async revokeToken(token) {
    if (token.refreshToken) {
      const refreshTokenHash = TokenService.hashString(token.refreshToken);
      await this.db.query('update oauth_tokens set revoked = 1 where refresh_token_hash=:refresh_token_hash', {
        refresh_token_hash: refreshTokenHash
      });
      return true;
    }
    return true;
  }

  async verifyScope(accessToken, requestedScopes): Promise<boolean> {
    const tokenScope = accessToken.scope;
    return [...tokenScope, 'openid'].some(scope => requestedScopes.includes(scope));
  }
  // end of node-oauth2-server model methods

  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>('select * from oauth_clients where client_id=:client_id', { client_id: clientId });
  }

  async getClientByClientIdAndClientSecretHash(clientId: string, clientSecretHash: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>('select * from oauth_clients where client_id=:client_id and client_secret_hash=:client_secret_hash', { client_id: clientId, client_secret_hash: clientSecretHash });
  }

  async getClientById(id: number): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>('select * from oauth_clients where id=:id', { id });
  }

  async getClients(userId: number): Promise<OAuth2ClientRaw[]> {
    return await this.db.fetchAll<OAuth2ClientRaw>(
      `select 
          oauth_clients.*,
          oauth_consents.user_id as is_authorized,
          if(oauth_clients.user_id = :user_id, 1, 0) as is_my
        from 
          oauth_clients 
        left outer join oauth_consents on oauth_consents.user_id = :user_id and oauth_consents.client_id = oauth_clients.id
        where 
          oauth_clients.is_public = 1 or 
          oauth_clients.user_id = :user_id or
          oauth_consents.user_id is not null`,
      { user_id: userId }
    );
  }

  async createClient(name: string, description: string, logoUrl: string, initialAuthorizationUrl: string, clientId: string, clientSecretHash: string, redirectUris: string, userId: number, isPublic: boolean): Promise<OAuth2ClientRaw> {
    const clientAutoincrementId = await this.db.insert('oauth_clients', {
      name,
      description,
      logo_url: logoUrl,
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      initial_authorization_url: initialAuthorizationUrl,
      redirect_uris: redirectUris,
      user_id: userId,
      grants: 'authorization_code,refresh_token',
      is_public: isPublic ? 1 : 0
    });

    return {
      id: clientAutoincrementId,
      name,
      description,
      logo_url: logoUrl,
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      initial_authorization_url: initialAuthorizationUrl,
      redirect_uris: redirectUris,
      user_id: userId,
      grants: 'authorization_code,refresh_token',
      is_public: isPublic ? 1 : 0
    } as OAuth2ClientRaw;
  }

  async createToken(clientId: number, userId: number, accessTokenHash: string, accessTokenExpiresAt: Date, refreshTokenHash: string, scope: string): Promise<void> {
    await this.db.insert('oauth_tokens', {
      client_id: clientId,
      user_id: userId,
      access_token_hash: accessTokenHash,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_hash: refreshTokenHash,
      scope
    });
  }

  async updateClientSecret(newSecretHash: string, id: number, userId: number): Promise<boolean> {
    return await this.db.query<ResultSetHeader>('update oauth_clients set client_secret_hash =: new_secret where id=:id and user_id=:user_id', {
      new_secret_hash: newSecretHash,
      id,
      user_id: userId
    }).then(_ => _.affectedRows > 0);
  }

  async deleteClient(clientNumericId: number, authorId: number): Promise<boolean> {
    return this.db.query<ResultSetHeader>(
      'delete from oauth_clients where id=:client_id and user_id=:user_id', {
        client_id: clientNumericId,
        user_id: authorId
      }).then(_ => _.affectedRows > 0);
  }

  async getRawTokensByClientId(id: number): Promise<OAuth2TokenRaw[]> {
    return await this.db.fetchAll<OAuth2TokenRaw>(`select * from oauth_tokens where client_id=:id`, {
      id
    });
  }

  async getRawTokensByClientAndUserId(id: number, userId: number): Promise<OAuth2TokenRaw[]> {
    return await this.db.fetchAll<OAuth2TokenRaw>(`select * from oauth_tokens where client_id=:id and user_id=:user_id`, {
      id,
      user_id: userId
    });
  }

  async unAuthorizeClient(id: number, userId: number): Promise<boolean> {
    await this.db.inTransaction(async (db) => {
      await this.db.query('update oauth_tokens set revoked = 1 where client_id=:id and user_id=:user_id', {
        id,
        user_id: userId
      });

      await this.db.query('delete from oauth_consents where client_id=:id and user_id=:user_id', {
        id,
        user_id: userId
      });
    });
    return true;
  }

  async updateClientLogoUrl(id: number, userId: number, url: string): Promise<boolean> {
    return await this.db.query<ResultSetHeader>('update oauth_clients set logo_url=:url where id=:id and user_id=:user_id', {
      url,
      id,
      user_id: userId
    }).then(_ => _.affectedRows > 0);
  }

  async getRevokedTokens(): Promise<OAuth2TokenRaw[]> {
    await this.db.query('delete from oauth_tokens where access_token_expires_at < now()');
    return await this.db.fetchAll<OAuth2TokenRaw>(`select * from oauth_tokens where revoked = 1`);
  }

  async getTokenByRefreshTokenHash(refreshTokenHash: string): Promise<OAuth2TokenRaw | undefined> {
    return await this.db.fetchOne<OAuth2TokenRaw>(`select ot.*, oc.client_id as client_client_id from oauth_tokens ot, oauth_clients oc where ot.refresh_token_hash = :refresh_token_hash and ot.revoked != 1 and ot.client_id = oc.id `, {
      refresh_token_hash: refreshTokenHash
    });
  }

  async getTokenByAccessTokenHash(accessTokenHash: string): Promise<OAuth2TokenRaw | undefined> {
    return await this.db.fetchOne<OAuth2TokenRaw>(`select ot.*, oc.client_id as client_client_id from oauth_tokens ot, oauth_clients oc where ot.access_token_hash = :access_token_hash and ot.revoked != 1 and ot.client_id = oc.id`, {
      access_token_hash: accessTokenHash
    });
  }

  async getConsent(clientId: number, userId: number): Promise<OAuth2ConsentRaw | undefined> {
    return await this.db.fetchOne<OAuth2ConsentRaw>(`select * from oauth_consents where user_id = :user_id and client_id = :client_id`, {
      client_id: clientId,
      user_id: userId
    });
  }

  async changeClientVisibility(clientId: number, userId: number): Promise<boolean> {
    return await this.db.query<ResultSetHeader>('update oauth_clients set is_public = abs(is_public - 1) where id=:id and user_id=:user_id', {
      id: clientId,
      user_id: userId
    }).then(_ => _.affectedRows > 0);
  }
}
