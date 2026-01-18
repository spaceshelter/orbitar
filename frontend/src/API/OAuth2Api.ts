import { BatchedCache } from '@utils/BatchedCache'

import { OAuth2ClientEntity } from '../Types/OAuth2'
import APIBase from './APIBase'

export type OAuth2ClientsListRequest = Record<string, never>

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[]
}

export type OAuth2RegisterRequest = {
  name: string
  description: string
  logoUrl?: string
  redirectUris: string
  initialAuthorizationUrl?: string
  clientType: 'public' | 'confidential'
}

export type OAuth2EditRequest = {
  clientId: string
  description: string
  redirectUris: string
  initialAuthorizationUrl?: string
}

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity
}
export type OAuth2UnAuthorizeRequest = {
  client_id: string
}

export type OAuth2UnAuthorizeResponse = {
  client: OAuth2ClientEntity
}

export type OAuth2GetClientRequest = {
  client_id: string
}

export type OAuth2GetClientResponse = {
  client: OAuth2ClientEntity
}

export type OAuth2GetClientsBatchRequest = {
  client_ids: string[]
}

export type OAuth2GetClientsBatchResponse = {
  clients: Record<string, OAuth2ClientEntity | null>
}

export type OAuth2RegenerateClientSecretRequest = {
  client_id: string
}

export type OAuth2RegenerateClientSecretResponse = {
  newSecret: string
}

export type OAuth2UpdateLogoRequest = {
  client_id: string
  url: string
}

export type OAuth2DeleteClientRequest = {
  client_id: string
}

export type OAuth2VerifyScopesRequest = {
  scopes: string
}

export type OAuth2VerifyScopesResponse = {
  scopes: Record<string, string>
}

export default class OAuth2Api {
  private api: APIBase
  private batchedCache: BatchedCache<string, OAuth2ClientEntity>

  constructor(api: APIBase) {
    this.api = api
    this.batchedCache = new BatchedCache<string, OAuth2ClientEntity>({
      debounceTime: 200,
      batchSize: 128,
      cacheTTL: 5 * 60 * 1000,
      fetchFunction: async (clientIds) => {
        const response = await this.getClientsBatch(clientIds)
        return response.clients
      },
    })
  }

  async registerClient(
    name: string,
    description: string,
    redirectUris: string,
    logoUrl = '',
    initialAuthorizationUrl = '',
    clientType: 'public' | 'confidential' = 'confidential',
  ): Promise<OAuth2RegisterResponse> {
    return await this.api.request<OAuth2RegisterRequest, OAuth2RegisterResponse>('/oauth2/client/register', {
      name,
      description,
      logoUrl,
      redirectUris: redirectUris,
      initialAuthorizationUrl,
      clientType,
    })
  }

  async editClient(
    clientId: string,
    description: string,
    redirectUris: string,
    initialAuthorizationUrl = '',
  ): Promise<OAuth2ClientEntity> {
    return await this.api
      .request<OAuth2EditRequest, OAuth2GetClientResponse>('/oauth2/client/edit', {
        clientId,
        description,
        redirectUris,
        initialAuthorizationUrl,
      })
      .then((response) => response.client)
  }

  async listClients(): Promise<OAuth2ClientsListResponse> {
    return await this.api.request<OAuth2ClientsListRequest, OAuth2ClientsListResponse>('/oauth2/clients', {})
  }

  async getClient(clientId: string): Promise<OAuth2GetClientResponse> {
    return await this.api.request<OAuth2GetClientRequest, OAuth2GetClientResponse>(`/oauth2/client`, {
      client_id: clientId,
    })
  }

  async getClientCached(clientId: string): Promise<OAuth2ClientEntity> {
    return this.batchedCache.get(clientId)
  }

  clearClientCache() {
    this.batchedCache.clearCache()
  }

  async getClientsBatch(clientIds: string[]): Promise<OAuth2GetClientsBatchResponse> {
    return await this.api.request<OAuth2GetClientsBatchRequest, OAuth2GetClientsBatchResponse>(
      `/oauth2/clients-batch`,
      { client_ids: clientIds },
    )
  }

  async unauthorizeClient(clientId: string): Promise<OAuth2ClientEntity> {
    return await this.api
      .request<OAuth2UnAuthorizeRequest, OAuth2UnAuthorizeResponse>('/oauth2/unauthorize', {
        client_id: clientId,
      })
      .then((response) => response.client)
  }

  async regenerateClientSecret(clientId: string): Promise<OAuth2RegenerateClientSecretResponse> {
    return await this.api.request<OAuth2RegenerateClientSecretRequest, OAuth2RegenerateClientSecretResponse>(
      `/oauth2/client/regenerate-secret`,
      { client_id: clientId },
    )
  }

  async updateClientLogo(clientId: string, url: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2UpdateLogoRequest, Record<string, never>>(`/oauth2/client/update-logo`, {
      client_id: clientId,
      url,
    })
  }

  async deleteClient(clientId: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2DeleteClientRequest, Record<string, never>>('/oauth2/client/delete', {
      client_id: clientId,
    })
  }

  async verifyScopes(scopes: string): Promise<Record<string, string>> {
    return await this.api
      .request<OAuth2VerifyScopesRequest, OAuth2VerifyScopesResponse>('/oauth2/verify-scopes', { scopes })
      .then((response) => response.scopes)
  }
}
