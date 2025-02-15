import DB from '../DB';
import { OAuth2ClientRaw } from '../types/OAuth2';
import { ResultSetHeader } from 'mysql2';

export default class OAuth2Repository {
  private db: DB;

  // Define a base SQL query that both methods share.
  private clientBaseQuery = `
    select 
      oauth_clients.*,
      oauth_consents.scope as scopes,
      oauth_consents.last_revoked_ts as last_revoked_ts,
      (select count(oauth_consents.user_id) from oauth_consents where client_id = oauth_clients.client_id) as installations_count 
    from oauth_clients
    left outer join oauth_consents
      on oauth_consents.client_id = oauth_clients.client_id
         and oauth_consents.user_id = :user_id
  `;

  constructor(db: DB) {
    this.db = db;
  }

  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      'select * from oauth_clients where client_id = :client_id',
      { client_id: clientId }
    );
  }

  async getClients(authorId: number, consentUserId: number): Promise<OAuth2ClientRaw[]> {
    return await this.db.fetchAll<OAuth2ClientRaw>(`
      ${this.clientBaseQuery}
      where oauth_clients.user_id = :author_id or oauth_consents.user_id = :user_id
    `, {
      author_id: authorId,
      user_id: consentUserId,
    });
  }

  async getClientByClientIdWithConsent(clientId: string, consentUserId: number): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(`
      ${this.clientBaseQuery}
      where oauth_clients.client_id = :client_id
    `, { 
      client_id: clientId, 
      user_id: consentUserId 
    });
  }

  async getNumberOfClientsCreatedByUser(userId: number): Promise<number> {
    const numberOfClientByUser = await this.db.fetchOne<{ cnt: string }>(`select count(*) as cnt from oauth_clients where user_id = :user_id`, {
      user_id: userId
    });
    return parseInt(numberOfClientByUser?.cnt || '0');
  }

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

  async deleteClient(clientId: string, authorId: number): Promise<boolean> {
    return this.db.query<ResultSetHeader>(
      'delete from oauth_clients where client_id = :client_id and user_id = :user_id',
      {
        client_id: clientId,
        user_id: authorId,
      }
    ).then(result => result.affectedRows > 0);
  }

  async updateConsentLastRevokeDate(clientId: string, userId: number): Promise<boolean> {
    const result = await this.db.query<ResultSetHeader>(
      'UPDATE oauth_consents SET last_revoked_ts = NOW() WHERE client_id = :client_id AND user_id = :user_id',
      {
        client_id: clientId,
        user_id: userId,
      }
    );
    return result.affectedRows > 0;
  }

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

  async saveOrUpdateConsent(clientId: string, userId: number, scope: string): Promise<boolean> {
    try {
      // Try to fetch an existing consent record.
      const existingConsent = await this.db.fetchOne<{ scope: string }>(
        'select scope from oauth_consents where user_id = :user_id and client_id = :client_id',
        { user_id: userId, client_id: clientId }
      );

      if (existingConsent) {
        // Merge the scopes while avoiding duplicates.
        const currentScopes = (existingConsent.scope || '').split(' ').filter(s => s.trim());
        const newScopes = scope.split(' ').filter(s => s.trim());
        const mergedScopes = Array.from(new Set([...currentScopes, ...newScopes]));
        const mergedScopeStr = mergedScopes.join(' ');

        await this.db.query(
          'update oauth_consents set scope = :scope, last_revoked_ts = NULL where user_id = :user_id and client_id = :client_id',
          { scope: mergedScopeStr, user_id: userId, client_id: clientId }
        );
      } else {
        // No record existing: insert a new record.
        await this.db.query(
          'insert into oauth_consents (user_id, client_id, scope) values (:user_id, :client_id, :scope)',
          { user_id: userId, client_id: clientId, scope }
        );
      }
      return true;
    } catch (error) {
      console.error('Failed to save oauth consent', error);
      return false;
    }
  }

  async resetConsentScope(clientId: string, userId: number): Promise<boolean> {
    return await this.db.query<ResultSetHeader>(
      `update oauth_consents set scope = '' where user_id = :user_id and client_id = :client_id`,
      { user_id: userId, client_id: clientId }
    ).then(result => result.affectedRows > 0);
  }

  async hasOwnApps(userId: number): Promise<boolean> {
    const res = await this.db.fetchOne<{ cnt: number }>(
      `SELECT 1 as cnt FROM oauth_clients WHERE user_id = :userId LIMIT 1`,
      { userId }
    );
    return res?.cnt > 0;
  }

  async editClient(
    clientId: string,
    description: string,
    redirectUris: string,
    initialAuthorizationUrl: string
  ): Promise<boolean> {
    return await this.db.query<ResultSetHeader>(`
      update oauth_clients set
        description = :description,
        redirect_uris = :redirect_uris,
        initial_authorization_url = :initial_authorization_url
      where client_id = :client_id`,
      {
        description: description,
        redirect_uris: redirectUris,
        initial_authorization_url: initialAuthorizationUrl,
        client_id: clientId,
      }
    ).then(result => result.affectedRows > 0);
  }
}
