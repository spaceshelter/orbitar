import { UserBaseEntity } from './UserEntity'

export type OAuth2ClientEntity = {
  name: string
  description: string
  clientId: string
  clientSecretHash?: string
  clientSecretOriginal?: string
  initialAuthorizationUrl?: string
  logoUrl?: string
  redirectUris: string
  grants: string
  clientType: 'public' | 'confidential'
  userId: number
  author: UserBaseEntity
  scopes?: string
  installationsCount?: number
}
