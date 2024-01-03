import APIBase from './APIBase';
import { OAuth2ClientEntity } from '../Types/OAuth2';

export type OAuth2ClientsListRequest = Record<string, never>;

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[];
};

export type OAuth2RegisterRequest = {
  name: string;
  description: string;
  logoUrl?: string;
  redirectUrls: string;
  initialAuthorizationUrl?: string;
  isPublic: boolean;
};

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2AuthorizeRequest = {
  clientId: string;
  scope: string;
  redirectUrl: string;
};

export type OAuth2AuthorizeResponse = {
  clientId: string;
  authorizationCode: string;
};

export type OAuth2UnAuthorizeRequest = {
  id: number;
};

export type OAuth2GetClientRequest = {
  clientId: string;
};

export type OAuth2GetClientResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2RegenerateClientSecretRequest = {
  id: number;
};

export type OAuth2RegenerateClientSecretResponse = {
  newSecret: string;
};

export type OAuth2UpdateLogoRequest = {
  id: number;
  url: string;
};

export type OAuth2DeleteClientRequest = {
  id: number;
};

export type OAuth2PublisheClientRequest = OAuth2DeleteClientRequest;
export type OAuth2HideClientRequest = OAuth2PublisheClientRequest;

export default class OAuth2Api {
  private api: APIBase;

  constructor(api: APIBase) {
    this.api = api;
  }

  async registerClient(name: string, description: string, redirectUrls: string, logoUrl = '', initialAuthorizationUrl = '', isPublic: boolean): Promise<OAuth2RegisterResponse> {
    return await this.api.request<OAuth2RegisterRequest, OAuth2RegisterResponse>('/oauth2/client/register', {
      name,
      description,
      logoUrl,
      redirectUrls,
      initialAuthorizationUrl,
      isPublic
    });
  }

  async listClients(): Promise<OAuth2ClientsListResponse> {
    return await this.api.request<OAuth2ClientsListRequest, OAuth2ClientsListResponse>('/oauth2/clients', {});
  }

  async getClient(clientId: string): Promise<OAuth2GetClientResponse> {
    return await this.api.request<OAuth2GetClientRequest, OAuth2GetClientResponse>(`/oauth2/client`, { clientId });
  }

  async authorizeClient(clientId: string, scope: string, redirectUrl: string): Promise<OAuth2AuthorizeResponse> {
    return await this.api.request<OAuth2AuthorizeRequest, OAuth2AuthorizeResponse>('/oauth2/authorize', {
      clientId,
      scope,
      redirectUrl
    });
  }

  async unauthorizeClient(id: number): Promise<Record<string, never>> {
    return await this.api.request<OAuth2UnAuthorizeRequest, Record<string, never>>('/oauth2/unauthorize', {
      id
    });
  }

  async regenerateClientSecret(id: number): Promise<OAuth2RegenerateClientSecretResponse> {
    return await this.api.request<OAuth2RegenerateClientSecretRequest, OAuth2RegenerateClientSecretResponse>(`/oauth2/client/regenerate-secret`, { id });
  }

  async updateClientLogo(id: number, url: string): Promise<Record<string, never>> {
    return await this.api.request<OAuth2UpdateLogoRequest, Record<string, never>>(`/oauth2/client/update-logo`, { id, url });
  }

  async deleteClient(id: number): Promise<Record<string, never>> {
    return await this.api.request<OAuth2DeleteClientRequest, Record<string, never>>('/oauth2/client/delete', {
      id
    });
  }

  async changeVisibility(id: number): Promise<Record<string, never>> {
    return await this.api.request<OAuth2DeleteClientRequest, Record<string, never>>('/oauth2/client/change-visibility', {
      id
    });
  }
}