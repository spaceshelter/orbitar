import { OAuth2ClientEntity } from '../entities/OAuth2ClientEntity';
import { OAuth2Token } from '../../../db/types/OAuth2';

export type OAuth2RegisterRequest = {
  name: string;
  description: string;
  logoUrl?: string;
  initialAuthorizationUrl?: string;
  redirectUrls: string;
  isPublic: boolean;
};

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2ClientRequest = {
  clientId: string;
};

export type OAuth2ClientManageRequest = {
  id: number;
};

export type OAuth2ClientResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2ClientsListRequest = Record<string, never>;

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[];
};

export type OAuth2AuthorizeRequest = {
  clientId: string;
  scope: string;
  redirectUrl: string;
};

export type OAuth2AuthorizeResponse = {
  authorizationCode: string;
};

export type OAuth2TokenRequest = {
  client_id: string;
  client_secret: string;
  grant_type: string;
  redirect_url?: string;
  code?: string;
  nonce?: string;
  refresh_token?: string;
};

export type OAuth2TokenResponse = {
  token: OAuth2Token;
};

export type OAuth2ClientRegenerateSecretResponse = {
  newSecret: string;
};

export type OAuth2ClientUpdateLogoUrlRequest = {
  id: number;
  url: string;
};

