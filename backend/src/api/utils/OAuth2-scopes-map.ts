const OAuth2ScopeEndpointsMap = {
  '/api/v1/feed/all': ['feed:all'],
  '/api/v1/post/create': ['post:write']
};

export const checkOAuthAccess = (url: string, scopes: string[]): boolean => {
  const allowedScopes = OAuth2ScopeEndpointsMap[url];
  if (!allowedScopes) {
    return false;
  }
  return allowedScopes.some(scope => scopes.includes(scope));
};
