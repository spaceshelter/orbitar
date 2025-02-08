import DB from '../DB';
import { OAuth2ClientRaw } from '../types/OAuth2';
import { ResultSetHeader } from 'mysql2';

export default class OAuth2Repository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /**
   * Retrieves a client by its client id.
   */
  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      'select * from oauth_clients where client_id = :client_id',
      { client_id: clientId }
    );
  }

  /**
   * Retrieves a client by its client id and client secret hash.
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
   * Retrieves a list of clients for a given user.
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
