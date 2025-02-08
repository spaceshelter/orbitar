import OAuth2Repository from '../db/repositories/OAuth2Repository';
import {Logger} from 'winston';
import {OAuth2ClientEntity} from '../api/types/entities/OAuth2ClientEntity';
import UserManager from './UserManager';
import {OAuth2ClientRaw} from '../db/types/OAuth2';
import AuthorizationCodeModelImpl from '../oauth/AuthorizationCodeModelImpl';

/**
 * OAuth2Manager orchestrates client management tasks including registration, listing, retrieval,
 * secret regeneration, and deletion.
 *
 * OAuth2 Flow Details:
 *   - During client registration, a unique client id and secret are generated.
 *   - The client secret is hashed and stored securely in the MySQL 'oauth_clients' table.
 *
 * Clients Management API Context:
 *   - Provides functionality for applications to register, view, update, or delete clients.
 *   - Integrates with UserManager to ensure owner validation.
 *
 * Data Storage:
 *   - Persistent client data is stored in MySQL. Session data is managed (potentially in Redis) by middleware.
 */
export default class OAuth2Manager {
  private oauthRepository: OAuth2Repository;
  private userManager: UserManager;
  private logger: Logger;

  constructor(oauthRepository: OAuth2Repository, userManager: UserManager, logger: Logger) {
    this.oauthRepository = oauthRepository;
    this.userManager = userManager;
    this.logger = logger;
  }

  /**
   * Registers a new OAuth2 client with the provided details.
   *
   * Process Details:
   *   - Generates a unique client ID and client secret.
   *   - Hashes the client secret for secure storage.
   *   - Stores the client's details (including redirect URIs, supported grants, etc.) in the MySQL 'oauth_clients' table.
   *
   * Note:
   *   - The original client secret (in plain text) is returned only on registration so that the client can store it securely.
   *
   * @param name Name of the client.
   * @param description Description of the client.
   * @param logoUrl URL for the client's logo.
   * @param initialAuthorizationUrl URL used to initiate the OAuth2 authorization.
   * @param redirectUris Allowed redirect URIs (comma separated).
   * @param userId The owner of this client.
   * @returns The registered OAuth2 client data (including the original client secret).
   */
  async registerClient(name: string, description: string, logoUrl: string, initialAuthorizationUrl: string, redirectUris: string, userId: number): Promise<OAuth2ClientRaw> {
    try {
      const clientId = AuthorizationCodeModelImpl.generateClientId();
      const clientSecret = AuthorizationCodeModelImpl.generateClientSecret();
      const clientSecretHash = AuthorizationCodeModelImpl.hashString(clientSecret);
      const result: OAuth2ClientRaw = await this.oauthRepository.createClient(name, description, logoUrl, initialAuthorizationUrl, clientId, clientSecretHash, redirectUris, userId);
      result.client_secret_original = clientSecret;
      return result;
    } catch (error) {
      this.logger.error('Error registering OAuth client', {error});
      throw error;
    }
  }


  async listClients(authorId: number, consentUserId?: number): Promise<OAuth2ClientEntity[]> {
    try {
      const clients = await this.oauthRepository.getClients(authorId, consentUserId || authorId);
      return await Promise.all(clients.map(async (client) => {
        const author = await this.userManager.getById(client.user_id);

        return {
          name: client.name,
          description: client.description,
          clientId: client.client_id,
          initialAuthorizationUrl: client.initial_authorization_url,
          redirectUris: client.redirect_uris,
          grants: client.grants,
          userId: client.user_id,
          logoUrl: client.logo_url,
          author,
          scopes: client.scopes,
        } as OAuth2ClientEntity;
      }));
    } catch (error) {
      this.logger.error('Error listing OAuth clients', {error});
      throw error;
    }
  }

  /**
   * Retrieves an OAuth2 client by its client ID.
   *
   * Flow Context:
   *   - Used on consent pages or token endpoints where client details are required.
   *   - Optionally includes the client secret hash if needed for client secret verification.
   *
   * @param clientId Unique client identifier.
   * @param currentUser Identifier of the current logged-in user.
   * @param includeSecret Flag indicating if the client secret hash should be included.
   * @returns An OAuth2ClientEntity object if found; otherwise, undefined.
   */
  async getClientByClientId(clientId: string, currentUser: number, includeSecret = false): Promise<OAuth2ClientEntity | undefined> {
    try {
      const client = await this.oauthRepository.getClientWithConsent(clientId, currentUser);
      if (!client) {
        return undefined;
      }
      const author = await this.userManager.getById(client.user_id);
      if (!author) {
        return undefined;
      }
      return {
        name: client.name,
        description: client.description,
        clientId: client.client_id,
        ...(includeSecret ? {clientSecretHash: client.client_secret_hash} : {}),
        initialAuthorizationUrl: client.initial_authorization_url,
        redirectUris: client.redirect_uris,
        grants: client.grants,
        userId: client.user_id,
        logoUrl: client.logo_url,
        author,
        scopes: client.scopes,
      } as OAuth2ClientEntity;
    } catch (error) {
      this.logger.error('Error getting OAuth client by client ID', {error});
      throw error;
    }
  }

  /**
   * Regenerates the client secret.
   *
   * Process:
   *   - Generates a new client secret.
   *   - Hashes the new secret and updates the stored hash in the MySQL database.
   *   - Returns the newly generated secret (in plain text) if the update is successful.
   *
   * @param clientId Unique client identifier.
   * @param authorId Identifier of the owner initiating the regeneration.
   * @returns The new client secret (plain text) if regeneration is successful; otherwise, undefined.
   */
  async regenerateClientSecret(clientId: string, authorId: number): Promise<string | undefined> {
    try {
      const clientSecret = AuthorizationCodeModelImpl.generateClientSecret();
      const clientSecretHash = AuthorizationCodeModelImpl.hashString(clientSecret);
      if (await this.oauthRepository.updateClientSecret(clientSecretHash, clientId, authorId)) {
        return clientSecret;
      }
      return null;
    } catch (error) {
      this.logger.error('Error regenerating OAuth client secret', {error});
      throw error;
    }
  }

  /**
   * Deletes an OAuth2 client.
   *
   * Flow Context:
   *   - Only the owner of the client is permitted to delete it.
   *   - The method first confirms the client exists and that the deletion request is from the owner.
   *
   * @param clientId Unique client identifier.
   * @param byUserId Identifier of the user attempting the deletion.
   * @returns True if the client was successfully deleted; otherwise, false.
   */
  async deleteClient(clientId: string, byUserId: number): Promise<boolean> {
    const client = await this.oauthRepository.getClientByClientId(clientId);
    if (!client) {
      this.logger.error('Error deleting OAuth client, no such client', {clientId});
      return false;
    }

    if (client.user_id !== byUserId) {
      this.logger.error('Error deleting OAuth client, not client owner initiated', {
        clientId,
        byUserId,
        authorId: client.user_id
      });
      return false;
    }

    return await this.oauthRepository.deleteClient(clientId, byUserId);
  }

  /**
   * Revokes a user's consent for an OAuth2 client.
   *
   * Flow:
   *   - When a user wishes to "disconnect" an application, the corresponding consent is revoked.
   *   - This sets the 'last_revoked_ts' column in the 'oauth_consents' table to the current time.
   *
   * @param clientId OAuth2 client identifier.
   * @param userId User identifier revoking the consent.
   * @returns True if the revocation was successful; otherwise, false.
   */
  async unAuthorizeClient(clientId: string, userId: number): Promise<boolean> {
    try {
      await this.oauthRepository.resetConsentScope(clientId, userId);
      return await this.oauthRepository.updateConsentLastRevokeDate(clientId, userId);
    } catch (error) {
      this.logger.error('Error unauthorizing OAuth client', {error});
      throw error;
    }
  }

  /**
   * Updates the logo URL for an OAuth2 client.
   *
   * Allows the client owner to update the branding of their application.
   *
   * @param clientId Unique client identifier.
   * @param userId Owner identifier.
   * @param logoUrl New logo URL.
   * @returns True if the update was successful; otherwise, false.
   */
  async updateClientLogoUrl(clientId: string, userId: number, logoUrl: string): Promise<boolean> {
    return await this.oauthRepository.updateClientLogoUrl(clientId, userId, logoUrl);
  }
}
