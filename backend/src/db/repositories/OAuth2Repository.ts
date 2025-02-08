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
   * Retrieves a client by its client id and client secret hash.
   * 
   * Security Note:
   *   This method is used during token exchanges to verify that the provided secret (after hash) matches what is stored.
   *
   * @param clientId Unique client id.
   * @param clientSecretHash Hashed representation of the client secret.
   * @returns The raw client data if authentication passes; otherwise, undefined.
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
   * Retrieves a list of clients associated with a given user.
   * 
   * Client Management API Context:
   *   This method is used to list both:
   *     - Clients that have been created by the user.
   *     - Clients for which the user has given consent (found via a left join on oauth_consents).
   *
   * Data Storage Details:
   *   - The query uses a JOIN between 'oauth_clients' and 'oauth_consents'.
   *   - Fields like `is_authorized` and `is_my` are computed to indicate authorization status.
   *
   * @param userId The user's unique identifier.
   * @returns Array of raw client records, enriched with authorization flags.
   */
  async getClients(userId: number): Promise<OAuth2ClientRaw[]> {
    return await this.db.fetchAll<OAuth2ClientRaw>(
      `select 
          oauth_clients.*,
          oauth_consents.user_id as is_authorized,
          if(oauth_clients.user_id = :user_id, 1, 0) as is_my
        from 
          oauth_clients 
        left outer join oauth_consents on oauth_consents.user_id = :user_id 
          and oauth_consents.client_id = oauth_clients.client_id
          and oauth_consents.last_revoked_ts is null
        where 
          oauth_clients.user_id = :user_id or
          oauth_consents.user_id is not null`,
      { user_id: userId }
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
   * @param userId The user's unique identifier.
   * @param clientId The OAuth client's unique identifier.
   * @param scope The scope string (space-separated) granted by the user.
   * @returns True if the consent was saved or updated successfully; otherwise, false.
   */
  async saveOrUpdateConsent(userId: number, clientId: string, scope: string): Promise<boolean> {
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
}
