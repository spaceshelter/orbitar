import APIBase from './APIBase';
import {OAuth2ClientEntity} from '../Types/OAuth2';

export type OAuth2ClientsListRequest = {
  username: string;
};

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

export type OAuth2AuthorizeRequest = {
  client_id: string;
  scope: string;
  redirect_uri: string;
  response_type: 'code';
};

export type OAuth2AuthorizeResponse = {
  clientId: string;
  authorizationCode: string;
};

export type OAuth2UnAuthorizeRequest = {
  client_id: string;
};

export type OAuth2GetClientRequest = {
  client_id: string;
};

export type OAuth2GetClientResponse = {
  client: OAuth2ClientEntity;
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

export type OAuth2PublisheClientRequest = OAuth2DeleteClientRequest;
export type OAuth2HideClientRequest = OAuth2PublisheClientRequest;

export type OAuth2VisibilityRequest = {
  client_id: string;
};

export default class OAuth2Api {
  private api: APIBase;

  constructor(api: APIBase) {
    this.api = api;
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

  async editClient(clientId: string, description: string, redirectUris: string, initialAuthorizationUrl = ''): Promise<void> {
    return await this.api.request<OAuth2EditRequest, void>('/oauth2/client/edit', {
      clientId,
      description,
      redirectUris,
      initialAuthorizationUrl
    });
  }

  async listClients(forUserName: string): Promise<OAuth2ClientsListResponse> {
    return await this.api.request<OAuth2ClientsListRequest, OAuth2ClientsListResponse>('/oauth2/clients', {
        username: forUserName
    });
  }

  async getClient(clientId: string): Promise<OAuth2GetClientResponse> {
    return await this.api.request<OAuth2GetClientRequest, OAuth2GetClientResponse>(`/oauth2/client`, { client_id: clientId });
  }

  async unauthorizeClient(clientId: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2UnAuthorizeRequest, Record<string, never>>('/oauth2/unauthorize', {
      client_id: clientId
    });
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
}
