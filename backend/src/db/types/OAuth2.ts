export interface OAuth2ClientRaw {
  id: number;
  name: string;
  description: string;
  logo_url: string;
  client_id: string;
  client_secret_hash: string;
  client_secret_original?: string;
  initial_authorization_url: string;
  redirect_uris: string;
  grants: string;
  user_id: number;
  scopes?: string;
  last_revoked_ts?: Date;
  installations_count?: number;
}
