import DB from '../DB';
import { OAuth2ClientRaw } from '../types/OAuth2';
import { ResultSetHeader } from 'mysql2';

/**
 * Repository for handling OAuth2 client and consent data.
 *
 * OAuth2 Flow Details:
 *   - Clients (applications) are registered and stored in the 'oauth_clients' table.
 *   - User consents are tracked in the 'oauth_consents' table.
 *
 * Note on Data Storage:
 *   - All persistent client and consent data is stored in a MySQL database.
 */
export default class OAuth2Repository {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  /**
   * Retrieves a client by its client ID.
   *
   * OAuth2 Flow Context:
   *   When a client tries to access protected resources, its details must be verified via its unique client_id.
   *
   * @param clientId Unique identifier for the OAuth2 client.
   * @returns The raw client data if found; otherwise, undefined.
   */
  async getClientByClientId(clientId: string): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      'select * from oauth_clients where client_id = :client_id',
      { client_id: clientId }
    );
  }

  /**
   * Retrieves a list of OAuth2 clients.
   *
   * Flow Context:
   *   - This method fetches clients either owned by the author or those for which the user has given consent.
   *   - The clients are retrieved from the 'oauth_clients' table, optionally joined with the 'oauth_consents' table.
   *
   * @param authorId The ID of the author (owner) of the clients.
   * @param consentUserId The ID of the user who has given consent to the clients.
   * @returns A promise that resolves to an array of OAuth2ClientRaw objects.
   */
  async getClients(authorId: number, consentUserId: number): Promise<OAuth2ClientRaw[]> {
    return await this.db.fetchAll<OAuth2ClientRaw>(
      `select 
          oauth_clients.*,
          oauth_consents.scope as scopes,
          oauth_consents.last_revoked_ts as last_revoked_ts
       from
           oauth_clients
       left outer join oauth_consents
            on oauth_consents.client_id = oauth_clients.client_id
                and oauth_consents.user_id = :user_id
       where
           oauth_clients.user_id = :author_id or oauth_consents.user_id = :user_id
          `,
      {
        author_id: authorId,
        user_id: consentUserId
      }
    );
  }

  /**
   * Retrieves an OAuth client along with the user's consent details.
   *
   * OAuth2 Flow Context:
   *   - This method fetches the client details along with the user's consent scope and revocation timestamp.
   *
   * @param clientId Unique client identifier.
   * @param consentUserId User identifier.
   * @returns The client data with consent details if found; otherwise, undefined.
   */
  async getClientWithConsent(clientId: string, consentUserId: number): Promise<OAuth2ClientRaw | undefined> {
    return await this.db.fetchOne<OAuth2ClientRaw>(
      `select 
          oauth_clients.*,
          oauth_consents.scope as scopes,
          oauth_consents.last_revoked_ts as last_revoked_ts
       from
           oauth_clients
       left outer join oauth_consents
           on oauth_consents.client_id = oauth_clients.client_id
               and oauth_consents.user_id = :user_id
       where
           oauth_clients.client_id = :client_id
      `,
      { user_id: consentUserId, client_id: clientId }
    );
  }

  /**
   * Creates a new OAuth client.
   *
   * OAuth2 Registration Flow:
   *   - When an application registers as an OAuth client, a unique client_id and a client secret are generated.
   *   - The secret is hashed for secure storage.
   *
   * Data Storage Details:
   *   The new client record is inserted into the 'oauth_clients' table along with details such as:
   *     - name, description, logo URL, initial authorization URL, redirect URIs, and supported grant types.
   *
   * @param name Name of the OAuth client.
   * @param description Description of the client.
   * @param logoUrl URL for the client's logo.
   * @param initialAuthorizationUrl The initial URL used as part of OAuth authorization.
   * @param clientId Generated unique client identifier.
   * @param clientSecretHash Hashed client secret.
   * @param redirectUris Redirect URIs as a comma-delimited string.
   * @param userId The owner of the client.
   * @returns The created OAuth2 client record.
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
   * Updates the client's secret hash.
   *
   * Use Case:
   *   When regenerating client secrets, this method updates the stored hash.
   *
   * @param newSecretHash New hashed value for the client secret.
   * @param clientId Unique client identifier.
   * @param userId Owner of the client.
   * @returns True if at least one row was affected, indicating success.
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
   *
   * Client Management API Context:
   *   The deletion action is permitted only if the user is the owner of the client.
   *
   * @param clientId Unique client identifier.
   * @param authorId Owner identifier.
   * @returns True if the client was successfully deleted; otherwise, false.
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
   * Revokes user consent for an OAuth client.
   *
   * OAuth2 Consent Flow:
   *   When a user revokes consent, this method updates the 'last_revoked_ts' to the current timestamp
   *   in the 'oauth_consents' table. This invalidates ongoing consents and indirectly affects token validity.
   *
   * @param clientId The client whose consent is being updated.
   * @param userId The ID of the user revoking the consent.
   * @returns True if the update succeeds; otherwise, false.
   */
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

  /**
   * Updates the logo URL for an OAuth client.
   *
   * Client Management API Context:
   *   This enables a client owner to change the branding (logo) of the OAuth client.
   *
   * @param clientId Unique client identifier.
   * @param userId Owner identifier.
   * @param url New logo URL value.
   * @returns True if the update was successful; otherwise, false.
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

  /**
   * Saves or updates a user's consent for an OAuth client.
   *
   * OAuth2 Consent Flow:
   *   - When a user grants permission (scope) to an application, that consent is stored.
   *   - If the user has previously consented, the scopes are merged to avoid duplication.
   *
   * Data Storage Details:
   *   The 'oauth_consents' table stores:
   *     - user_id
   *     - client_id
   *     - scope (space-separated list of permissions)
   *     - last_revoked_ts to track revocation events.
   *
   * @param clientId The OAuth client's unique identifier.
   * @param userId The user's unique identifier.
   * @param scope The scope string (space-separated) granted by the user.
   * @returns True if the consent was saved or updated successfully; otherwise, false.
   */
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


  hasOwnApps(userId: number) {
      return this.db.fetchOne<{cnt: number}>(`SELECT 1 as cnt FROM oauth_clients WHERE user_id = :userId limit 1` , {userId})
          .then(res => res?.cnt > 0);
  }
}
