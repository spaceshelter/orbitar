import OAuth2Repository from '../db/repositories/OAuth2Repository';
import {Logger} from 'winston';
import {OAuth2ClientEntity} from '../api/types/entities/OAuth2ClientEntity';
import UserManager from './UserManager';
import {OAuth2ClientRaw} from '../db/types/OAuth2';
import AuthorizationCodeModelImpl from '../oauth/AuthorizationCodeModelImpl';
import {config} from '../config';

export default class OAuth2Manager {
  private oauthRepository: OAuth2Repository;
  private userManager: UserManager;
  private logger: Logger;

  constructor(oauthRepository: OAuth2Repository, userManager: UserManager, logger: Logger) {
    this.oauthRepository = oauthRepository;
    this.userManager = userManager;
    this.logger = logger;
  }

  async registerClient(name: string, description: string, logoUrl: string, initialAuthorizationUrl: string, redirectUris: string, userId: number): Promise<OAuth2ClientRaw> {
    try {
      const currentNumberOfClientsByUser = await this.oauthRepository.getNumberOfClientsCreatedByUser(userId);
      if (currentNumberOfClientsByUser >= config.oauth.maxNumberOfClientsPerDeveloper) {
        throw 'Too many clients already created';
      }

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
      return await this.enrichClientEntities(clients);
    } catch (error) {
      this.logger.error('Error listing OAuth clients', {error});
      throw error;
    }
  }

  async getClientByClientId(clientId: string, currentUser: number, includeSecret = false): Promise<OAuth2ClientEntity | undefined> {
    try {
      const client = await this.oauthRepository.getClientByClientIdWithConsent(clientId, currentUser);
      if (!client) {
        return undefined;
      }
      return await this.enrichClientEntity(client, includeSecret);
    } catch (error) {
      this.logger.error('Error getting OAuth client by client ID', {error});
      throw error;
    }
  }

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
      await this.oauthRepository.resetConsentScope(clientId, userId);
      return await this.oauthRepository.updateConsentLastRevokeDate(clientId, userId);
    } catch (error) {
      this.logger.error('Error unauthorizing OAuth client', {error});
      throw error;
    }
  }

  async updateClientLogoUrl(clientId: string, userId: number, logoUrl: string): Promise<boolean> {
    return await this.oauthRepository.updateClientLogoUrl(clientId, userId, logoUrl);
  }

  async hasOwnApps(userId: number) {
    return this.oauthRepository.hasOwnApps(userId);
  }

  async editClient(
    clientId: string,
    description: string,
    redirectUris: string,
    initialAuthorizationUrl: string
  ): Promise<boolean> {
    return await this.oauthRepository.editClient(clientId, description, redirectUris, initialAuthorizationUrl);
  }

  async getClientsByClientIds(clientIds: string[], userId: number) {
    const clients =  await this.oauthRepository.getClientsByClientIds(clientIds, userId);
    return await this.enrichClientEntities(clients);
  }

  private async enrichClientEntity(client: OAuth2ClientRaw, includeSecret = false): Promise<OAuth2ClientEntity | undefined> {
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
      installationsCount: client.installations_count
    } as OAuth2ClientEntity;
  }

  private async enrichClientEntities(clients: OAuth2ClientRaw[], includeSecret = false): Promise<OAuth2ClientEntity[]> {
    const enriched = [];
    for (const client of clients) {
      // we deliberately want to do this sequentially as to not overload the database
      const enrichedClient = await this.enrichClientEntity(client, includeSecret);
      if (enrichedClient) {
        enriched.push(enrichedClient);
      }
    }
    return enriched;
  }
}
