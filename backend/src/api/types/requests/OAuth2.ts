import { OAuth2ClientEntity } from '../entities/OAuth2ClientEntity';
import { OAuth2Token } from '../../../db/types/OAuth2';

export type OAuth2RegisterRequest = {
  name: string;
  description: string;
  logoUrl?: string;
  initialAuthorizationUrl?: string;
  redirectUris: string;
};

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2ClientRequest = {
  client_id: string;
};

export type OAuth2ClientManageRequest = {
  client_id: string;
};

export type OAuth2ClientResponse = {
  client: OAuth2ClientEntity;
};

export type OAuth2ClientsListRequest = {
  username: string;
};

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[];
};

export type OAuth2AuthorizeRequest = {
  client_id: string;
  scope: string;
  redirect_uri: string;
};

export type OAuth2AuthorizeResponse = {
  authorizationCode: string;
};

export type OAuth2TokenRequest = {
  client_id: string;
  client_secret: string;
  grant_type: string;
  redirect_uri?: string;
  code?: string;
  refresh_token?: string;
};

export type OAuth2TokenResponse = {
  token: OAuth2Token;
};

export type OAuth2ClientRegenerateSecretResponse = {
  newSecret: string;
};

export type OAuth2ClientUpdateLogoUrlRequest = {
  client_id: string;
  url: string;
};

