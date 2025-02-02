import { Router } from 'express';
import { Logger } from 'winston';
import { APIRequest, APIResponse, validate, urisListValidator } from './ApiMiddleware';
import OAuth2Manager from '../managers/OAuth2Manager';
import {
  OAuth2RegisterRequest,
  OAuth2RegisterResponse,
  OAuth2ClientsListRequest,
  OAuth2ClientsListResponse,
  OAuth2ClientRequest,
  OAuth2ClientResponse,
  OAuth2ClientRegenerateSecretResponse, OAuth2ClientUpdateLogoUrlRequest, OAuth2ClientManageRequest
} from './types/requests/OAuth2';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import UserManager from '../managers/UserManager';
import {OAuth2ClientEntity} from './types/entities/OAuth2ClientEntity';
import {OAuth2ClientRaw} from '../db/types/OAuth2';
import ExpressOAuthServer from 'express-oauth-server';

const clientRegisterSchema = Joi.object<OAuth2RegisterRequest>({
  name: Joi.string().max(32).required(),
  description: Joi.string().max(255).required(),
  logoUrl: Joi.string()
    .uri({
      scheme: ['http', 'https']
    })
    .max(255)
    .allow(null)
    .allow('')
    .messages({
      'string.uri': 'The field must be a valid URL.'
    }),
  initialAuthorizationUrl: Joi.string()
    .uri({
      scheme: ['http', 'https']
    })
    .max(255)
    .allow(null)
    .allow('')
    .messages({
      'string.uri': 'The field must be a valid URL.'
    }),
  redirectUris: urisListValidator
    .max(255).required()
    .messages({
      'any.required': 'Redirect URIs are required.',
      'any.invalid': 'Please enter valid comma-separated URIs.'
    }),
  isPublic: Joi.boolean().required()
});

const listClientsSchema = Joi.object<OAuth2ClientsListRequest>({})
  .pattern(/.*/, Joi.any().forbidden());

const getClientSchema = Joi.object<OAuth2ClientRequest>({
  clientId: Joi.alternatives().try(
    Joi.string().max(255),
    Joi.number()
  ).required()
});

const getTokenSchema = Joi.object({
  client_id: Joi.string().max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.optional(), otherwise: Joi.required() }),
  client_secret: Joi.string().max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.optional(), otherwise: Joi.required() }),
  grant_type: Joi.string().valid('authorization_code', 'refresh_token').required(),
  code: Joi.string().max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.optional(), otherwise: Joi.required() }),
  redirect_uri: Joi.string().uri({ scheme: ['http', 'https'] }).max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.optional() }),
  refresh_token: Joi.string().max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.required(), otherwise: Joi.optional() })
});

const clientManageSchema = Joi.object<OAuth2ClientManageRequest>({
  id: Joi.number().required()
});

const updateLogoUrlSchema = Joi.object<OAuth2ClientUpdateLogoUrlRequest>({
  id: Joi.number().required(),
  url: Joi.string()
    .uri({
      scheme: ['http', 'https']
    })
    .max(255).required()
});

export default class OAuth2Controller {
  router = Router();
  private readonly oauth2Manager: OAuth2Manager;
  private readonly userManager: UserManager;
  private readonly logger: Logger;
  private readonly oauthExpressServer: ExpressOAuthServer;

  constructor(oauth2Manager: OAuth2Manager, userManager: UserManager, oauth2ExpressServer: ExpressOAuthServer, logger: Logger) {
    this.oauth2Manager = oauth2Manager;
    this.userManager = userManager;
    this.logger = logger;
    this.oauthExpressServer = oauth2ExpressServer;

    const registerLimiter = rateLimit({
      windowMs: 60 * 60 * 1000 /* 1 hour */,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: false,
      legacyHeaders: false
    });

    const commonLimiter = rateLimit({
        windowMs: 60 * 1000 /* 1 minute */,
        max: 60,
        standardHeaders: false,
        legacyHeaders: false,
        keyGenerator: (req) => String(req.session.data?.userId)
    });

    this.router.post('/oauth2/clients', commonLimiter, validate(listClientsSchema), (req, res) => this.listClients(req, res));
    this.router.post('/oauth2/client', commonLimiter, validate(getClientSchema), (req, res) => this.getClientByClientId(req, res));
    this.router.post('/oauth2/client/register', registerLimiter, validate(clientRegisterSchema), (req, res) => this.register(req, res));
    this.router.post('/oauth2/client/regenerate-secret', commonLimiter, validate(clientManageSchema), (req, res) => this.regenerateClientSecret(req, res));
    this.router.post('/oauth2/client/update-logo', commonLimiter, validate(updateLogoUrlSchema), (req, res) => this.updateClientLogoUrl(req, res));
    this.router.post('/oauth2/client/delete', commonLimiter, validate(clientManageSchema), (req, res) => this.deleteClient(req, res));
    this.router.post('/oauth2/client/change-visibility', commonLimiter, validate(clientManageSchema), (req, res) => this.changeClientVisibility(req, res));
    this.router.post('/oauth2/authorize', commonLimiter, (req, res) => this.oauthExpressServer.authorize({
      authenticateHandler: {
        handle: async (req) => {
          await req.session.restore(req.body['X-Session-Id']);
          if (req.session.isBarmalini() && req.session.getAgeMillis() > /*1 hour*/ 60 * 60 * 1000) {
            await req.session.destroy();
            return null;
          }
          if (!req?.session?.data?.userId) {
            return null;
          }
          return {
            id: req.session.data.userId
          };
        }
      }
    })(req, res, () => {}));
    this.router.post('/oauth2/unauthorize', commonLimiter, validate(clientManageSchema), (req, res) => this.unAuthorizeClient(req, res));
    this.router.post('/oauth2/token', commonLimiter, validate(getTokenSchema), (req, res) => this.oauthExpressServer.token({})(req, res, () => {}));
  }

  /**
   * Create (register) new OAuth2 client
   */
  async register(request: APIRequest<OAuth2RegisterRequest>, response: APIResponse<OAuth2RegisterResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const {name, description, logoUrl, initialAuthorizationUrl, redirectUris, isPublic} = request.body;
      const userId = request.session.data.userId;
      const author = await this.userManager.getById(userId);

      const client: OAuth2ClientRaw = await this.oauth2Manager.registerClient(name, description, logoUrl, initialAuthorizationUrl, redirectUris, userId, isPublic);
      const responseData: OAuth2RegisterResponse = {
        client: {
          id: client.id,
          name: client.name,
          description: client.description,
          clientId: client.client_id,
          clientSecretOriginal: client.client_secret_original,
          clientSecretHash: client.client_secret_hash,
          initialAuthorizationUrl: client.initial_authorization_url,
          redirectUris: client.redirect_uris,
          grants: client.grants,
          userId: client.user_id,
          author,
          isPublic: client.is_public === 1
        }
      };
      response.success(responseData);
    } catch (err) {
      this.logger.error('OAuth2 client registration error', { error: err });
      if (err.code === 'ER_DUP_ENTRY') {
        return response.error('duplicate-client', 'A client app with that name already exists', 400);
      }
      return response.error('error', 'Failed to register', 500);
    }
  }

  /**
   * List clients: returns public clients, clients created by this user and clients authorized by this user
   */
  async listClients(request: APIRequest<OAuth2ClientsListRequest>, response: APIResponse<OAuth2ClientsListResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    const userId = request.session.data.userId;

    try {
      const clients: OAuth2ClientEntity[] = await this.oauth2Manager.listClients(userId);
      const responseData: OAuth2ClientsListResponse = { clients };
      response.success(responseData);
    } catch (err) {
      this.logger.error('OAuth2 client list load', { error: err });
      return response.error('error', 'Failed to load client apps', 500);
    }
  }

  /**
   * Get client by client ID to be displayed on the client consent page
   */
  async getClientByClientId(request: APIRequest<OAuth2ClientRequest>, response: APIResponse<OAuth2ClientResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const { clientId } = request.body;
      const client = await this.oauth2Manager.getClientByClientId(clientId);
      if (!client) {
        this.logger.error('Failed to fetch client data', { clientId });
        return response.error('error', 'Failed to fetch client data', 500);
      }
      response.success({ client });
    } catch (err) {
        this.logger.error('Failed to fetch client data', { error: err });
        return response.error('error', 'Failed to fetch client data', 500);
    }
  }

  /**
   * Regenerate client secret in case it was compromised or lost
   */
  async regenerateClientSecret(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<OAuth2ClientRegenerateSecretResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const { id } = request.body;
      const newSecret = await this.oauth2Manager.regenerateClientSecret(id, request.session.data.userId);
      if (!newSecret) {
        return response.error('error', 'Failed to generate new client secret', 500);
      }
      response.success({ newSecret });
    } catch (err) {
        this.logger.error('Failed to generate new client secret', { error: err });
        return response.error('error', 'Failed to generate new client secret', 500);
    }
  }

  /**
   * Delete client, initiated by client author, when client is deleted, all tokens issued for it are marked as revoked
   */
  async deleteClient(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    try {
      const {id} = request.body;
      if (await this.oauth2Manager.deleteClient(id, request.session.data.userId)) {
        return response.success({});
      }
    } catch (err) {
        this.logger.error('Failed to delete client', { error: err });
        return response.error('error', 'Failed to delete client', 500);
    }
  }

  /**
   * Unauthorize client, initiated by client user, when client is unathorized, all tokens issued for it are marked as revoked
   */
  async unAuthorizeClient(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    try {
      const { id } = request.body;
      if (typeof id !== 'number') {
        this.logger.error('Failed to unauthorize client, invalid ID', { id });
        return response.error('error', 'Failed to unauthorize client, invalid ID', 500);
      }
      const result = await this.oauth2Manager.unAuthorizeClient(id, userId);
      if (!result) {
        return response.error('error', 'Failed to unauthorize client', 500);
      }
      response.success({});
    } catch (err) {
        this.logger.error('Failed to unauthorize client', { error: err });
        return response.error('error', 'Failed to unauthorize client', 500);
    }
  }

  /**
   * Update client logo URL, initiated by client author
   */
  async updateClientLogoUrl(request: APIRequest<OAuth2ClientUpdateLogoUrlRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    try {
      const {id, url} = request.body;
      const result = await this.oauth2Manager.updateClientLogoUrl(id, userId, url);
      if (!result) {
        return response.error('error', 'Failed to update client logo', 500);
      }
      response.success({});
    } catch (err) {
        this.logger.error('Failed to update client logo', { error: err });
        return response.error('error', 'Failed to update client logo', 500);
    }
  }

  /**
   * Change client visibility (0 or 1), initiated by client author, when client is not public, it is not displayed in the list of public clients
   * This does not accept visibility value because it is just flipping the current value
   */
  async changeClientVisibility(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    try {
      const {id} = request.body;
      const result = await this.oauth2Manager.changeClientVisibility(id, userId);
      if (!result) {
        return response.error('error', 'Failed to publish client', 500);
      }
      response.success({});
    } catch (err) {
        this.logger.error('Failed to publish client', { error: err });
        return response.error('error', 'Failed to publish client', 500);
    }
  }
}
