import { UserBaseInfo } from './UserInfo'

export type OAuth2ClientEntity = {
  id: number
  name: string
  description: string
  clientId: string
  clientSecretOriginal?: string
  clientSecretHash?: string
  logoUrl?: string
  initialAuthorizationUrl: string
  redirectUris: string
  grants: string[]
  author: UserBaseInfo
  scopes?: string
  installationsCount?: number
}
