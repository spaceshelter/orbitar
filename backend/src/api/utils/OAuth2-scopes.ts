const OAuth2ScopeEndpointsMap = {
  '/api/v1/feed/all': [
    'feed',
    'feed:all'
  ],
  '/api/v1/feed/subscriptions': [
    'feed',
    'feed:subscriptions'
  ],
  '/api/v1/feed/posts': [
    'feed',
    'feed:posts'
  ],
  '/api/v1/feed/watch': [
    'feed',
    'feed:watch'
  ],
  '/api/v1/feed/sorting': [
    'feed',
    'feed:sorting'
  ],
  '/api/v1/invite/check': [
    'invite',
    'invite:check'
  ],
  '/api/v1/invite/use': [
    'invite',
    'invite:use'
  ],
  '/api/v1/invite/list': [
    'invite',
    'invite:list'
  ],
  '/api/v1/invite/regenerate': [
    'invite',
    'invite:regenerate'
  ],
  '/api/v1/invite/create': [
    'invite',
    'invite:create'
  ],
  '/api/v1/invite/delete': [
    'invite:delete'
  ],
  '/api/v1/notifications/list': [
    'notifications',
    'notifications:list'
  ],
  '/api/v1/notifications/read': [
    'notifications',
    'notifications:read'
  ],
  '/api/v1/notifications/hide': [
    'notifications',
    'notifications:hide'
  ],
  '/api/v1/notifications/read/all': [
    'notifications',
    'notifications:read',
    'notifications:read:all'
  ],
  '/api/v1/notifications/hide/all': [
    'notifications',
    'notifications:hide',
    'notifications:hide:all'
  ],
  '/api/v1/notifications/subscribe': [
    'notifications',
    'notifications:subscribe'
  ],
  '/api/v1/oauth2/clients': [
    'oauth2',
    'oauth2:clients'
  ],
  '/api/v1/oauth2/client': [
    'oauth2',
    'oauth2:client'
  ],
  '/api/v1/oauth2/client/register': [
    'oauth2',
    'oauth2:client',
    'oauth2:client:register'
  ],
  '/api/v1/oauth2/client/regenerate-secret': [
    'oauth2',
    'oauth2:client',
    'oauth2:client:regenerate-secret'
  ],
  '/api/v1/oauth2/client/update-logo': [
    'oauth2',
    'oauth2:client',
    'oauth2:client:update-logo'
  ],
  '/api/v1/oauth2/client/delete': [
    'oauth2',
    'oauth2:client',
    'oauth2:client:delete'
  ],
  '/api/v1/oauth2/client/change-visibility': [
    'oauth2',
    'oauth2:client',
    'oauth2:client:change-visibility'
  ],
  '/api/v1/oauth2/authorize': [
    'oauth2',
    'oauth2:authorize'
  ],
  '/api/v1/oauth2/unauthorize': [
    'oauth2',
    'oauth2:unauthorize'
  ],
  '/api/v1/oauth2/token': [
    'oauth2',
    'oauth2:token'
  ],
  '/api/v1/post/get': [
    'post',
    'post:get'
  ],
  '/api/v1/post/create': [
    'post',
    'post:create'
  ],
  '/api/v1/post/edit': [
    'post',
    'post:edit'
  ],
  '/api/v1/post/comment': [
    'post',
    'post:comment'
  ],
  '/api/v1/post/preview': [
    'post',
    'post:preview'
  ],
  '/api/v1/post/read': [
    'post',
    'post:read'
  ],
  '/api/v1/post/bookmark': [
    'post',
    'post:bookmark'
  ],
  '/api/v1/post/watch': [
    'post',
    'post:watch'
  ],
  '/api/v1/post/translate': [
    'post',
    'post:translate'
  ],
  '/api/v1/post/get-comment': [
    'post',
    'post:get-comment'
  ],
  '/api/v1/post/edit-comment': [
    'post',
    'post:edit-comment'
  ],
  '/api/v1/post/history': [
    'post',
    'post:history'
  ],
  '/api/v1/post/get-public-key': [
    'post',
    'post:get-public-key'
  ],
  '/api/v1/search': [
    'search'
  ],
  '/api/v1/site': [
    'site'
  ],
  '/api/v1/site/subscribe': [
    'site',
    'site:subscribe'
  ],
  '/api/v1/site/subscriptions': [
    'site',
    'site:subscriptions'
  ],
  '/api/v1/site/list': [
    'site',
    'site:list'
  ],
  '/api/v1/site/create': [
    'site',
    'site:create'
  ],
  '/api/v1/status': [
    'status'
  ],
  '/api/v1/user/profile': [
    'user',
    'user:profile'
  ],
  '/api/v1/user/posts': [
    'user',
    'user:posts'
  ],
  '/api/v1/user/comments': [
    'user',
    'user:comments'
  ],
  '/api/v1/user/karma': [
    'user',
    'user:karma'
  ],
  '/api/v1/user/clearCache': [
    'user',
    'user:clearCache'
  ],
  '/api/v1/user/restrictions': [
    'user',
    'user:restrictions'
  ],
  '/api/v1/user/savebio': [
    'user',
    'user:savebio'
  ],
  '/api/v1/user/savename': [
    'user',
    'user:savename'
  ],
  '/api/v1/user/savegender': [
    'user',
    'user:savegender'
  ],
  '/api/v1/user/suggest-username': [
    'user',
    'user:suggest-username'
  ],
  '/api/v1/user/save-public-key': [
    'user',
    'user:save-public-key'
  ],
  '/api/v1/vote/set': [
    'vote',
    'vote:set'
  ],
  '/api/v1/vote/list': [
    'vote',
    'vote:list'
  ]
};

export const checkOAuthAccess = (url: string, scopes: string[]): boolean => {
  const allowedScopes = OAuth2ScopeEndpointsMap[url];
  if (!allowedScopes) {
    return false;
  }
  return allowedScopes.some(scope => scopes.includes(scope));
};
