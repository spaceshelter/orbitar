import { Router } from 'express';
import { Logger } from 'winston';
import { APIRequest, APIResponse, validate, urlsListValidator } from './ApiMiddleware';
import OAuth2Manager from '../managers/OAuth2Manager';
import {
  OAuth2RegisterRequest,
  OAuth2RegisterResponse,
  OAuth2ClientsListRequest,
  OAuth2ClientsListResponse,
  OAuth2AuthorizeRequest,
  OAuth2AuthorizeResponse,
  OAuth2ClientRequest,
  OAuth2ClientResponse,
  OAuth2TokenRequest, OAuth2TokenResponse,
  OAuth2ClientRegenerateSecretResponse, OAuth2ClientUpdateLogoUrlRequest, OAuth2ClientManageRequest
} from './types/requests/OAuth2';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import UserManager from '../managers/UserManager';
import { OAuth2ClientEntity } from './types/entities/OAuth2ClientEntity';
import { OAuth2ClientRaw, OAuth2Token } from '../db/types/OAuth2';
import TokenService from '../oauth/TokenService';

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
  redirectUrls: urlsListValidator
    .max(255).required()
    .messages({
      'any.required': 'Redirect URLs are required.',
      'any.invalid': 'Please enter valid comma-separated URLs.'
    }),
  isPublic: Joi.boolean().required()
});

const clientAuthorizeSchema = Joi.object<OAuth2AuthorizeRequest>({
  clientId: Joi.string().max(255).required(),
  scope: Joi.string().max(255).required(),
  redirectUrl: Joi.string()
    .uri({
      scheme: ['http', 'https']
    })
    .max(255).required()
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
  nonce: Joi.string().max(255)
    .when('grant_type', { is: 'refresh_token', then: Joi.optional(), otherwise: Joi.required() }),
  redirect_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(255)
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

  constructor(oauth2Manager: OAuth2Manager, userManager: UserManager, logger: Logger) {
    this.oauth2Manager = oauth2Manager;
    this.userManager = userManager;
    this.logger = logger;

    const registerLimiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: false,
      legacyHeaders: false
    });


    this.router.post('/oauth2/clients', validate(listClientsSchema), (req, res) => this.listClients(req, res));
    this.router.post('/oauth2/client', validate(getClientSchema), (req, res) => this.getClientByClientId(req, res));
    this.router.post('/oauth2/client/register', registerLimiter, validate(clientRegisterSchema), (req, res) => this.register(req, res));
    this.router.post('/oauth2/client/regenerate-secret', validate(clientManageSchema), (req, res) => this.regenerateClientSecret(req, res));
    this.router.post('/oauth2/client/update-logo', validate(updateLogoUrlSchema), (req, res) => this.updateClientLogoUrl(req, res));
    this.router.post('/oauth2/client/delete', validate(clientManageSchema), (req, res) => this.deleteClient(req, res));
    this.router.post('/oauth2/client/change-visibility', validate(clientManageSchema), (req, res) => this.changeClientVisibility(req, res));
    this.router.post('/oauth2/authorize', validate(clientAuthorizeSchema), (req, res) => this.authorizeClient(req, res));
    this.router.post('/oauth2/unauthorize', validate(clientManageSchema), (req, res) => this.unAuthorizeClient(req, res));
    this.router.post('/oauth2/token', validate(getTokenSchema), (req, res) => this.generateToken(req, res));
  }

  async register(request: APIRequest<OAuth2RegisterRequest>, response: APIResponse<OAuth2RegisterResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    const { name, description, logoUrl, initialAuthorizationUrl, redirectUrls, isPublic } = request.body;
    const userId = request.session.data.userId;
    const author = await this.userManager.getById(userId);

    try {
      const client: OAuth2ClientRaw = await this.oauth2Manager.registerClient(name, description, logoUrl, initialAuthorizationUrl, redirectUrls, userId, isPublic);
      const responseData: OAuth2RegisterResponse = {
        client: {
          id: client.id,
          name: client.name,
          description: client.description,
          clientId: client.client_id,
          clientSecretOriginal: client.client_secret_original,
          clientSecretHash: client.client_secret_hash,
          initialAuthorizationUrl: client.initial_authorization_url,
          redirectUrls: client.redirect_urls,
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

  async authorizeClient(request: APIRequest<OAuth2AuthorizeRequest>, response: APIResponse<OAuth2AuthorizeResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    const { clientId, scope, redirectUrl } = request.body;

    try {
      const client = await this.oauth2Manager.getClientByClientId(clientId);
      if (!client) {
        return response.error('invalid-client', 'Invalid client ID', 400);
      }

      const authorizationCode = await this.oauth2Manager.authorizeClientAndGetAuthorizationCode(client, request.session.data.userId, scope, redirectUrl);
      if (!authorizationCode) {
        return response.error('invalid-client', 'Failed to generate authorization code', 500);
      }

      response.success({ authorizationCode });
    } catch (err) {
      this.logger.error('OAuth2 authorize client failed', { error: err });
      return response.error('error', 'Failed to authorize this client', 500);
    }
  }

  async getClientByClientId(request: APIRequest<OAuth2ClientRequest>, response: APIResponse<OAuth2ClientResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    const { clientId } = request.body;
    const client = await this.oauth2Manager.getClientByClientId(clientId);
    if (!client) {
      this.logger.error('Failed to fetch client data', { clientId });
      return response.error('error', 'Failed to fetch client data', 500);
    }
    response.success({ client });
    return;
  }

  async generateToken(request: APIRequest<OAuth2TokenRequest>, response: APIResponse<OAuth2TokenResponse>) {
    const { client_id, client_secret, grant_type, code, nonce, refresh_token } = request.body;
    let token: OAuth2Token;

    if (grant_type === 'refresh_token') {
      token = await this.oauth2Manager.generateTokenWithRefreshToken(refresh_token);
      if (!token) {
        return response.error('error', 'Failed to get new access token', 500);
      }
      return response.success({ token });
    }

    const clientSecretHashed = TokenService.hashString(client_secret);
    const client = await this.oauth2Manager.getClientByClientId(client_id, true);

    if (!client || client_id !== client.clientId || clientSecretHashed !== client.clientSecretHash) {
      this.logger.error('Invalid client id or secret', { client_id, client_secret });
      return response.error('invalid-client', 'Invalid client ID', 400);
    }

    try {
      token = await this.oauth2Manager.generateTokenWithAuthorizationCode(client, grant_type, code, nonce);
      if (!token) {
        return response.error('invalid-client', 'Failed to generate token', 500);
      }
      response.success({ token });
    } catch (err) {
      this.logger.error('OAuth2 generate token failed', { error: err });
      return response.error('error', 'Failed to generate token', 500);
    }
  }

  async regenerateClientSecret(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<OAuth2ClientRegenerateSecretResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }
    const { id } = request.body;
    const newSecret = await this.oauth2Manager.regenerateClientSecret(id, request.session.data.userId);
    if (!newSecret) {
      return response.error('error', 'Failed to generate new client secret', 500);
    }
    response.success({ newSecret });
  }

  async deleteClient(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    const { id } = request.body;
    if (await this.oauth2Manager.deleteClient(id, request.session.data.userId)) {
      return response.success({});
    }
  }

  async unAuthorizeClient(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
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
  }

  async updateClientLogoUrl(request: APIRequest<OAuth2ClientUpdateLogoUrlRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    const { id, url } = request.body;
    const result = await this.oauth2Manager.updateClientLogoUrl(id, userId, url);
    if (!result) {
      return response.error('error', 'Failed to update client logo', 500);
    }
    response.success({});
  }

  async changeClientVisibility(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<Record<string, never>>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    const { id } = request.body;
    const result = await this.oauth2Manager.changeClientVisibility(id, userId);
    if (!result) {
      return response.error('error', 'Failed to publish client', 500);
    }
    response.success({});
  }
}
