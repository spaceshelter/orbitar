import { UserInfo } from '../../../managers/types/UserInfo';

export type OAuth2ClientEntity = {
  name: string;
  description: string;
  clientId: string;
  clientSecretHash?: string;
  clientSecretOriginal?: string;
  initialAuthorizationUrl?: string;
  logoUrl?: string;
  redirectUris: string;
  grants: string;
  userId: number;
  author: UserInfo;
  scopes?: string
};
