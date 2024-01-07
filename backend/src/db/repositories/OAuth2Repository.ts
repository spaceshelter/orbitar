// backend/src/db/repositories/OAuth2Repository.ts

import DB from '../DB';
import { OAuth2ClientRaw, OAuth2AuthorizationCodeRaw, OAuth2TokenRaw, OAuth2ConsentRaw } from '../types/OAuth2';
import { ResultSetHeader } from 'mysql2';

export default class OAuth2Repository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>('select * from oauth_clients where client_id=:client_id', { client_id: clientId });
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

  async authorizeClient(clientId: number, userId: number, scope: string, redirectUri: string, authorizationCodeHash: string, authorizationCodeExpiresAt: Date): Promise<boolean> {
    await this.db.inTransaction(async (db) => {
      // save consent
      await this.db.query('insert into oauth_consents (user_id, client_id, scope) values (:user_id, :client_id, :scope) on duplicate key update scope=:scope', {
        user_id: userId,
        client_id: clientId,
        scope
      });

      // clear old codes
      await db.query('delete from oauth_codes where client_id=:client_id and user_id=:user_id', {
        client_id: clientId,
        user_id: userId
      });

      // save code
      await db.insert('oauth_codes', {
        client_id: clientId,
        user_id: userId,
        code_hash: authorizationCodeHash,
        expires_at: authorizationCodeExpiresAt,
        scope,
        redirect_uri: redirectUri
      });
    });
    return true;
  }

  async getAuthorizationCode(codeHash: string): Promise<OAuth2AuthorizationCodeRaw | undefined> {
    return await this.db.fetchOne<OAuth2AuthorizationCodeRaw>(`select * from oauth_codes where code_hash = :code_hash`, {
      code_hash: codeHash
    });
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
    return await this.db.fetchOne<OAuth2TokenRaw>(`select * from oauth_tokens where refresh_token_hash = :refresh_token_hash`, {
      refresh_token_hash: refreshTokenHash
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
