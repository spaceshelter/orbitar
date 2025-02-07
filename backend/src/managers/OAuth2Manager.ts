import OAuth2Repository from '../db/repositories/OAuth2Repository';
import {Logger} from 'winston';
import TokenService from '../oauth/TokenService';
import {OAuth2ClientEntity} from '../api/types/entities/OAuth2ClientEntity';
import UserManager from './UserManager';
import {OAuth2ClientRaw} from '../db/types/OAuth2';

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
   * Generates a unique client ID and secret, then stores the client information in the repository.
   */
  async registerClient(name: string, description: string, logoUrl: string, initialAuthorizationUrl: string, redirectUris: string, userId: number): Promise<OAuth2ClientRaw> {
    try {
      const clientId = TokenService.generateClientId();
      const clientSecret = TokenService.generateClientSecret();
      const clientSecretHash = TokenService.hashString(clientSecret);
      const result: OAuth2ClientRaw = await this.oauthRepository.createClient(name, description, logoUrl, initialAuthorizationUrl, clientId, clientSecretHash, redirectUris, userId);
      result.client_secret_original = clientSecret;
      return result;
    } catch (error) {
      this.logger.error('Error registering OAuth client', {error});
      throw error;
    }
  }

  /**
   * Lists OAuth2 clients. userId is used to determine which clients are authorized by the user and which clients were created by the user.
   */
  async listClients(userId: number, currentUser: number): Promise<OAuth2ClientEntity[]> {
    try {
      const clients = await this.oauthRepository.getClients(userId);
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
          isAuthorized: !!client.is_authorized,
          isMy: author.id === currentUser
        } as OAuth2ClientEntity;
      }));
    } catch (error) {
      this.logger.error('Error listing OAuth clients', {error});
      throw error;
    }
  }

  /**
   * Gets an OAuth2 client by its client ID (not numeric `id` from the table)
   * It is used on consent page to show client details.
   * If includeSecret is true, the client secret hash will be included in the result, which is needed to verify client secret provided to the token endpoint.
   */
  async getClientByClientId(clientId: string, currentUser: number, includeSecret = false): Promise<OAuth2ClientEntity | undefined> {
    try {
      const client = await this.oauthRepository.getClientByClientId(clientId);
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
        isMy: author.id === currentUser,
      } as OAuth2ClientEntity;
    } catch (error) {
      this.logger.error('Error getting OAuth client by client ID', {error});
      throw error;
    }
  }

  /**
   * called to change client secret code
   */
  async regenerateClientSecret(clientId: string, authorId: number): Promise<string | undefined> {
    try {
      const clientSecret = TokenService.generateClientSecret();
      const clientSecretHash = TokenService.hashString(clientSecret);
      if (await this.oauthRepository.updateClientSecret(clientSecretHash, clientId, authorId)) {
        return clientSecret;
      }
      return null;
    } catch (error) {
      this.logger.error('Error regenerating OAuth client secret', {error});
      throw error;
    }
  }

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

  async unAuthorizeClient(clientId: string, userId: number): Promise<boolean> {
    try {
      return await this.oauthRepository.unAuthorizeClient(clientId, userId);
    } catch (error) {
      this.logger.error('Error unauthorizing OAuth client', {error});
      throw error;
    }
  }

  async updateClientLogoUrl(clientId: string, userId: number, logoUrl: string): Promise<boolean> {
    return await this.oauthRepository.updateClientLogoUrl(clientId, userId, logoUrl);
  }
}
