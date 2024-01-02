import { UserInfo } from './UserInfo';

export type OAuth2ClientEntity = {
  id: number;
  name: string;
  description: string;
  clientId: string;
  clientSecretOriginal?: string;
  clientSecretHash?: string;
  logoUrl?: string;
  initialAuthorizationUrl: string;
  redirectUrls: string;
  grants: string[];
  author: UserInfo;
  isPublic: boolean;
  isAuthorized?: boolean;
  isMy?: boolean;
};
