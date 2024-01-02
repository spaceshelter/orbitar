export interface OAuth2ClientRaw {
  id: number;
  name: string;
  description: string;
  logo_url: string;
  client_id: string;
  client_secret_hash: string;
  client_secret_original?: string;
  initial_authorization_url: string;
  redirect_urls: string;
  grants: string;
  user_id: number;
  is_public: number;
  is_my?: number;
  is_authorized?: number;
}

export interface OAuth2Token {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
  refresh_token?: string;
  scope: string;
}

export interface OAuth2TokenRaw {
  access_token_hash: string;
  access_token_expires_at: Date;
  refresh_token_hash: string;
  client_id: number;
  user_id: number;
  scope: string;
  revoked: number;
}

export interface OAuth2AuthorizationCodeRaw {
  client_id: number;
  user_id: number;
  code: string;
  expires_at: Date;
  scope: string;
  redirect_url: string;
}

export interface OAuth2RefreshTokenCheckResult {
  userId: number;
  scope: string;
}

export interface OAuth2ConsentRaw {
  user_id: number;
  client_id: number;
  scope: string;
}
