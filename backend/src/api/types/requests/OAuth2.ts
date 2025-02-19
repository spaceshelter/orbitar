import { OAuth2ClientEntity } from '../entities/OAuth2ClientEntity'

export type OAuth2RegisterRequest = {
  name: string
  description: string
  logoUrl?: string
  initialAuthorizationUrl?: string
  redirectUris: string
}

export type OAuth2RegisterResponse = {
  client: OAuth2ClientEntity
}

export type OAuth2EditRequest = {
  clientId: string
  description: string
  redirectUris: string
  initialAuthorizationUrl: string
}

export type OAuth2ClientRequest = {
  client_id: string
}

export type OAuth2ClientManageRequest = {
  client_id: string
}

export type OAuth2ClientResponse = {
  client: OAuth2ClientEntity
}

export type OAuth2ClientsListRequest = Record<string, never>

export type OAuth2ClientsListResponse = {
  clients: OAuth2ClientEntity[]
}

export type OAuth2ClientsBatchRequest = {
  client_ids: string[]
}

export type OAuth2ClientsBatchResponse = {
  clients: Record<string, OAuth2ClientEntity | null>
}

export type OAuth2ClientRegenerateSecretResponse = {
  newSecret: string
}

export type OAuth2ClientUpdateLogoUrlRequest = {
  client_id: string
  url: string
}

export type OAuth2VerifyScopesRequest = {
  scopes: string
}

export type OAuth2VerifyScopesResponse = {
  scopes: Record<string, string>
}
