import APIBase from './APIBase';
import {OAuth2ClientEntity} from '../Types/OAuth2';

export type OAuth2ClientsListRequest = Record<string, never>;

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[];
};

export type OAuth2RegisterRequest = {
  name: string;
  description: string;
  logoUrl?: string;
  redirectUris: string;
  initialAuthorizationUrl?: string;
};

export type OAuth2EditRequest = {
  clientId: string;
  description: string;
  redirectUris: string;
  initialAuthorizationUrl?: string;
};

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity;
};
export type OAuth2UnAuthorizeRequest = {
  client_id: string;
};

export type OAuth2UnAuthorizeResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2GetClientRequest = {
  client_id: string;
};

export type OAuth2GetClientResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2GetClientsBatchRequest = {
  client_ids: string[];
};

export type OAuth2GetClientsBatchResponse = {
  clients: Record<string, OAuth2ClientEntity | null>;
};

export type OAuth2RegenerateClientSecretRequest = {
  client_id: string;
};

export type OAuth2RegenerateClientSecretResponse = {
  newSecret: string;
};

export type OAuth2UpdateLogoRequest = {
  client_id: string;
  url: string;
};

export type OAuth2DeleteClientRequest = {
  client_id: string;
};

export type OAuth2VerifyScopesRequest = {
  scopes: string;
};

export type OAuth2VerifyScopesResponse = {
  scopes: Record<string, string>;
};

export default class OAuth2Api {
  private api: APIBase;
  private batchedCache: OAuthClientBatchedCache;

  constructor(api: APIBase) {
    this.api = api;
    this.batchedCache = new OAuthClientBatchedCache(clientIds =>
        this.getClientsBatch(clientIds).then(response => response.clients)
    );
  }

  async registerClient(name: string, description: string, redirectUris: string, logoUrl = '', initialAuthorizationUrl = ''): Promise<OAuth2RegisterResponse> {
    return await this.api.request<OAuth2RegisterRequest, OAuth2RegisterResponse>('/oauth2/client/register', {
      name,
      description,
      logoUrl,
      redirectUris: redirectUris,
      initialAuthorizationUrl
    });
  }

  async editClient(clientId: string, description: string, redirectUris: string, initialAuthorizationUrl = ''): Promise<OAuth2ClientEntity> {
    return await this.api.request<OAuth2EditRequest, OAuth2GetClientResponse>('/oauth2/client/edit', {
      clientId,
      description,
      redirectUris,
      initialAuthorizationUrl
    }).then(response => response.client);
  }

  async listClients(): Promise<OAuth2ClientsListResponse> {
    return await this.api.request<OAuth2ClientsListRequest, OAuth2ClientsListResponse>('/oauth2/clients', {
    });
  }

  async getClient(clientId: string): Promise<OAuth2GetClientResponse> {
    return await this.api.request<OAuth2GetClientRequest, OAuth2GetClientResponse>(`/oauth2/client`, { client_id: clientId });
  }

  async getClientCached(clientId: string): Promise<OAuth2ClientEntity> {
    return this.batchedCache.getClient(clientId);
  }

  async getClientsBatch(clientIds: string[]): Promise<OAuth2GetClientsBatchResponse> {
    return await this.api.request<OAuth2GetClientsBatchRequest, OAuth2GetClientsBatchResponse>(`/oauth2/clients-batch`, { client_ids: clientIds });
  }

  async unauthorizeClient(clientId: string): Promise<OAuth2ClientEntity> {
    return await this.api.request<OAuth2UnAuthorizeRequest, OAuth2UnAuthorizeResponse>('/oauth2/unauthorize', {
      client_id: clientId
    }).then(response => response.client);
  }

  async regenerateClientSecret(clientId: string): Promise<OAuth2RegenerateClientSecretResponse> {
    return await this.api.request<OAuth2RegenerateClientSecretRequest, OAuth2RegenerateClientSecretResponse>(
      `/oauth2/client/regenerate-secret`,
      { client_id: clientId }
    );
  }

  async updateClientLogo(clientId: string, url: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2UpdateLogoRequest, Record<string, never>>(
      `/oauth2/client/update-logo`,
      { client_id: clientId, url }
    );
  }

  async deleteClient(clientId: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2DeleteClientRequest, Record<string, never>>('/oauth2/client/delete', {
      client_id: clientId
    });
  }

  async verifyScopes(scopes: string): Promise<Record<string, string>> {
      return await this.api.request<OAuth2VerifyScopesRequest, OAuth2VerifyScopesResponse>('/oauth2/verify-scopes', { scopes })
      .then(response => response.scopes);
  }
}


// The result from your batch endpoint
interface BatchResponse {
  [clientId: string]: OAuth2ClientEntity | null;
}

interface Controllable<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

// TODO make this class generic
/**
 * A batched + cached api client for OAuth2 clients.
 * Wraps multiple requests into a single batch request, and caches the results.
 */
class OAuthClientBatchedCache {

  batchRequest: (clientIds: string[]) => Promise<BatchResponse>;

  constructor(batchRequest: (clientIds: string[]) => Promise<BatchResponse>) {
    this.batchRequest = batchRequest;
  }

  // Cache: clientId -> { data, expiresAt }
  private cache = new Map<string, { data: OAuth2ClientEntity; expiresAt: number }>();

  // Pending requests queue
  private queue = new Set<string>();

  // For each clientId, we store resolvers to fulfill once we have data
  private pendingResolvers = new Map<string, Controllable<OAuth2ClientEntity>>();

  // Time in ms to wait for "debounce" before sending batch request
  private debounceTime = 100;

  // Max queue size before sending a batch request
  private maxQueueSize = 255;

  // TTL in ms (5 minutes)
  private ttl = 5 * 60 * 1000;

  // Timer handle for debouncing
  private timer: NodeJS.Timeout | null = null;

  /**
   * Public method to get a single client's data,
   * internally uses a batched + cached request.
   */
  public getClient(clientId: string): Promise<OAuth2ClientEntity> {
    // If the data is in cache and not expired, return it immediately
    const now = Date.now();
    const cached = this.cache.get(clientId);
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.data);
    }

    const pending = this.pendingResolvers.get(clientId);
    if (pending) {
      return pending.promise;
    }

    // Put this request into pending resolvers
    let resolve: (value: OAuth2ClientEntity | PromiseLike<OAuth2ClientEntity>) => void;
    let reject: (reason?: any) => void;
    const prom = new Promise<OAuth2ClientEntity>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.pendingResolvers.set(clientId, {promise: prom, resolve: resolve!, reject: reject!});

    // Add clientId to batch queue
    this.queue.add(clientId);

    // Start or reset the debounce timer
    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (this.queue.size >= this.maxQueueSize) {
      this.flushQueue();
      return prom;
    }

    this.timer = setTimeout(() => {
      this.flushQueue();
    }, this.debounceTime);

    return prom;
  }

  /**
   * Flushes the queue: calls the batch endpoint with all queued clientIds,
   * updates cache, and resolves all pending promises.
   */
  private async flushQueue() {
    // Make a local copy of the queue so we can clear it
    const clientIds = Array.from(this.queue);
    this.queue.clear();
    this.timer = null;

    if (clientIds.length === 0) {
      return;
    }

    try {
      // Send a single batch request
      const results = await this.batchRequest(clientIds);

      const now = Date.now();

      // Update cache & resolve each request
      for (const id of clientIds) {
        const clientData = results[id] || null;
        if (clientData) {
          this.cache.set(id, {
            data: clientData,
            expiresAt: now + this.ttl,
          });
        }

        const resolver = this.pendingResolvers.get(id);
        if (resolver) {
          if (clientData) {
            resolver.resolve(clientData);
          } else {
            resolver.reject(new Error(`No client data found for ID: ${id}`));
          }
          this.pendingResolvers.delete(id);
        }
      }
    } catch (err) {
      // If something blows up, we should reject all pending resolvers
      for (const id of clientIds) {
        const resolver = this.pendingResolvers.get(id);
        resolver?.reject(err);
      }
      console.error('Error fetching clients batch:', err);
    }
  }
}
