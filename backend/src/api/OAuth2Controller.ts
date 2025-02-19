import {Router} from 'express';
import {Logger} from 'winston';
import {APIRequest, APIResponse, joiClientId, urisListValidator, validate} from './ApiMiddleware';
import OAuth2Manager from '../managers/OAuth2Manager';
import {
  OAuth2ClientManageRequest,
  OAuth2ClientRegenerateSecretResponse,
  OAuth2ClientRequest,
  OAuth2ClientResponse,
  OAuth2ClientsBatchRequest,
  OAuth2ClientsBatchResponse,
  OAuth2ClientsListRequest,
  OAuth2ClientsListResponse,
  OAuth2ClientUpdateLogoUrlRequest,
  OAuth2EditRequest,
  OAuth2RegisterRequest,
  OAuth2RegisterResponse,
  OAuth2VerifyScopesRequest,
  OAuth2VerifyScopesResponse
} from './types/requests/OAuth2';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import UserManager from '../managers/UserManager';
import {OAuth2ClientEntity} from './types/entities/OAuth2ClientEntity';
import {OAuth2ClientRaw} from '../db/types/OAuth2';
import ExpressOAuthServer from '@node-oauth/express-oauth-server';
import {config} from '../config';
import {escapeRegExp} from '../parser/regexprs';
import {ExpressOauth2ScopesFilter} from './OAuth2Middleware';

const clientRegisterSchema = Joi.object<OAuth2RegisterRequest>({
  name: Joi.string()
      .pattern(/^[a-zа-яё_\d .-]{2,32}$/i)
      .required()
      .messages({
        'string.pattern.base': 'Only letters, numbers, space, and some special characters are allowed, 2 to 32 characters',
        'any.required': 'Name is required'
      }),
  description: Joi.string().max(255).required().allow(''),
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
    })
});

const clientEditSchema = Joi.object<OAuth2EditRequest>({
  clientId: Joi.string().min(36).max(36).required(),
  description: Joi.string().max(255).required().allow(''),
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
    })
});

const listClientsSchema = Joi.object<OAuth2ClientsListRequest>({})
    .pattern(/.*/, Joi.any().forbidden());

const getClientSchema = Joi.object<OAuth2ClientRequest>({
  client_id: joiClientId.required()
});

// clients batch
const getClientBatchSchema = Joi.object<OAuth2ClientsBatchRequest>({
  client_ids: Joi.array().items(joiClientId).max(256).required()
});

const clientManageSchema = Joi.object<OAuth2ClientManageRequest>({
  client_id: joiClientId.required()
});

const updateLogoUrlSchema = Joi.object<OAuth2ClientUpdateLogoUrlRequest>({
  client_id: joiClientId.required(),
  url: Joi.string()
      .uri({
        scheme: ['http', 'https']
      })
      .max(255)
      .pattern(new RegExp(`^${escapeRegExp(config.mediaHosting.url)}`))
      .required()
});

const verifyScopesSchema = Joi.object({
  scopes: Joi.string().required()
});

export default class OAuth2Controller {
  router = Router();
  private readonly oauth2Manager: OAuth2Manager;
  private readonly userManager: UserManager;
  private readonly logger: Logger;
  private readonly oauthExpressServer: ExpressOAuthServer;
  private readonly oauthScopesFilter: ExpressOauth2ScopesFilter;

  constructor(oauth2Manager: OAuth2Manager, userManager: UserManager, scopesFilter:ExpressOauth2ScopesFilter, oauth2ExpressServer: ExpressOAuthServer, logger: Logger) {
    this.oauth2Manager = oauth2Manager;
    this.userManager = userManager;
    this.logger = logger;
    this.oauthExpressServer = oauth2ExpressServer;
    this.oauthScopesFilter = scopesFilter;

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
    this.router.post('/oauth2/clients-batch', commonLimiter, validate(getClientBatchSchema), (req, res) => this.getClientsByClientIdsBatch(req, res));
    this.router.post('/oauth2/client/register', registerLimiter, validate(clientRegisterSchema), (req, res) => this.register(req, res));
    this.router.post('/oauth2/client/edit', commonLimiter, validate(clientEditSchema), (req, res) => this.edit(req, res));
    this.router.post('/oauth2/client/regenerate-secret', commonLimiter, validate(clientManageSchema), (req, res) => this.regenerateClientSecret(req, res));
    this.router.post('/oauth2/client/update-logo', commonLimiter, validate(updateLogoUrlSchema), (req, res) => this.updateClientLogoUrl(req, res));
    this.router.post('/oauth2/client/delete', commonLimiter, validate(clientManageSchema), (req, res) => this.deleteClient(req, res));
    this.router.post('/oauth2/verify-scopes', commonLimiter, validate(verifyScopesSchema), (req, res) => this.verifyScopes(req, res));
    this.router.post('/oauth2/authorize', commonLimiter, (req, res) => this.oauthExpressServer.authorize({
      authenticateHandler: {
        handle: async (req) => {
          await req.session.restore(req.body['X-Session-Id']);
          if (req.session.isBarmalini()) {
            return null;
          }
          if (!req?.session?.data?.userId) {
            return null;
          }
          try {
            const user = await this.userManager.getById(req.session.data.userId);
            return {
              id: req.session.data.userId,
              username: user.username,
            };
          } catch (err) {
            this.logger.error('Failed to fetch user data', { error: err });
            return null;
          }
        }
      }
    })(req, res, () => {}));
    this.router.post('/oauth2/unauthorize', commonLimiter, validate(clientManageSchema), (req, res) => this.unAuthorizeClient(req, res));
    this.router.post('/oauth2/token', commonLimiter, (req, res) => this.oauthExpressServer.token({})(req, res, () => {}));
  }

  /**
   * Create (register) new OAuth2 client
   */
  async register(request: APIRequest<OAuth2RegisterRequest>, response: APIResponse<OAuth2RegisterResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const {name, description, logoUrl, initialAuthorizationUrl, redirectUris} = request.body;
      const userId = request.session.data.userId;
      const author = await this.userManager.getById(userId);

      const client: OAuth2ClientRaw = await this.oauth2Manager.registerClient(name, description, logoUrl, initialAuthorizationUrl, redirectUris, userId);
      const responseData: OAuth2RegisterResponse = {
        client: {
          name: client.name,
          description: client.description,
          clientId: client.client_id,
          clientSecretOriginal: client.client_secret_original,
          clientSecretHash: client.client_secret_hash,
          initialAuthorizationUrl: client.initial_authorization_url,
          redirectUris: client.redirect_uris,
          grants: client.grants,
          userId: client.user_id,
          author
        }
      };
      response.success(responseData);
    } catch (err) {
      this.logger.error('OAuth2 client registration error', { error: err });
      if (err.code === 'ER_DUP_ENTRY') {
        return response.error('duplicate-client', 'A client app with that name already exists', 400);
      }
      return response.error('error', 'Failed to register: ' + err, 500);
    }
  }

  /**
   * edit a client, name cannot be edited
   */
  async edit(request: APIRequest<OAuth2EditRequest>, response: APIResponse<OAuth2ClientResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const {clientId, description, redirectUris, initialAuthorizationUrl} = request.body;
      const userId = request.session.data.userId;
      const client = await this.oauth2Manager.getClientByClientId(clientId, userId);
      if (!client) {
        return response.error('error', 'Client not found', 404);
      }
      const result = await this.oauth2Manager.editClient(clientId, description, redirectUris, initialAuthorizationUrl);
      if (!result) {
        return response.error('error', 'Failed to update client', 500);
      }
      const newClient = await this.oauth2Manager.getClientByClientId(clientId, userId);
      if (!newClient) {
          return response.error('error', 'Failed to update client', 500);
      }
      response.success({ client: newClient });
    } catch (err) {
      this.logger.error('Failed to update client', { error: err });
      return response.error('error', 'Failed to update client', 500);
    }
  }

  /**
   * List clients: returns clients created by this user and clients authorized by this user
   */
  async listClients(request: APIRequest<OAuth2ClientsListRequest>, response: APIResponse<OAuth2ClientsListResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      const currentUserId = request.session.data.userId;

      // Load clients created by the given user with current user consent
      const clients: OAuth2ClientEntity[] = await this.oauth2Manager.listClients(currentUserId, currentUserId);
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
      const { client_id : clientId } = request.body;
      const userId = request.session.data.userId;
      const client = await this.oauth2Manager.getClientByClientId(clientId, userId);
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
   * Get clients by client IDs
   */
  async getClientsByClientIdsBatch(request: APIRequest<OAuth2ClientsBatchRequest>, response: APIResponse<OAuth2ClientsBatchResponse>) {
    if (!request.session.data.userId) {
      return response.authRequired();
    }

    try {
      let { client_ids: clientIds } = request.body;
      // dedup
      clientIds = Array.from(new Set(clientIds));

      if (clientIds.length === 0) {
        return response.success({clients: {}});
      }

      const userId = request.session.data.userId;
      const clients: OAuth2ClientEntity[] = await this.oauth2Manager.getClientsByClientIds(clientIds, userId);

      // map clients to object by client_id
      const clientsMap: Record<string, OAuth2ClientEntity | null> = {};
      clients.forEach(client => {
          clientsMap[client.clientId] = client;
      });

      // fill the gaps
      clientIds.forEach(clientId => {
          if (!clientsMap[clientId]) {
              clientsMap[clientId] = null;
          }
      });
      response.success({ clients: clientsMap });
    } catch (err) {
      this.logger.error('Failed to fetch clients data', { error: err });
      return response.error('error', 'Failed to fetch clients data', 500);
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
      const { client_id : clientId } = request.body;
      const newSecret = await this.oauth2Manager.regenerateClientSecret(clientId.toString(), request.session.data.userId);
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
      const {client_id : clientId} = request.body;
      if (await this.oauth2Manager.deleteClient(clientId.toString(), request.session.data.userId)) {
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
  async unAuthorizeClient(request: APIRequest<OAuth2ClientManageRequest>, response: APIResponse<OAuth2ClientResponse>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }
    try {
      const { client_id : clientId } = request.body;
      const result = await this.oauth2Manager.unAuthorizeClient(clientId, userId);
      if (!result) {
        return response.error('error', 'Failed to unauthorize client', 500);
      }
      const newClient = await this.oauth2Manager.getClientByClientId(clientId, userId);
      if (!newClient) {
          return response.error('error', 'Failed to unauthorize client', 500);
      }
      response.success({client: newClient});
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
      const {client_id : clientId, url} = request.body;
      const result = await this.oauth2Manager.updateClientLogoUrl(clientId.toString(), userId, url);
      if (!result) {
        return response.error('error', 'Failed to update client logo', 500);
      }
      response.success({});
    } catch (err) {
        this.logger.error('Failed to update client logo', { error: err });
        return response.error('error', 'Failed to update client logo', 500);
    }
  }

  private verifyScopes(request: APIRequest<OAuth2VerifyScopesRequest>, response: APIResponse<OAuth2VerifyScopesResponse>) {
    const userId = request.session.data.userId;
    if (!userId) {
      return response.authRequired();
    }

    const scopes =
        ExpressOauth2ScopesFilter.minimizeScopes(
            this.oauthScopesFilter.filterScopes(
                ExpressOauth2ScopesFilter.splitScope(request.body.scopes)
            ));

    // group resolved scopes that are subscopes of the same parent scope
    const groupedDescs: Record<string, string> = scopes.reduce((acc, scope) => {
      const resolvedScopes = this.oauthScopesFilter.resolveScopes([scope]);
      const scopesToDescription = this.oauthScopesFilter.mapScopesToDescriptions(resolvedScopes);
      // join description values
      acc[scope] = Object.values(scopesToDescription).join(', ');
       return acc;
    }, {});

    response.success({scopes: groupedDescs});
  }
}
