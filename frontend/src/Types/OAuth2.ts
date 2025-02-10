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
  redirectUris: string;
  grants: string[];
  author: UserInfo;
  scopes?: string;
};

export const OAuth2ScopesLabels: { [key: string]: string; } = {
  'openid': 'ID пользователя',
  'feed': 'все действия с фидами',
  'feed:all': 'фид /all',
  'feed:posts': 'фид постов',
  'feed:sorting': 'изменение сортировки фидов',
  'feed:subscriptions': 'фид подписок',
  'feed:watch': 'фид отслеживаемых',
  'invite': 'все действия с инвайтами',
  'invite:check': 'проверка инвайта',
  'invite:create': 'создание инвайта',
  'invite:delete': 'удаление инвайта',
  'invite:list': 'список инвайтов',
  'invite:regenerate': 'перегенерация инвайта',
  'invite:use': 'использование инвайта',
  'notifications': 'все действия с уведомлениями',
  'notifications:hide': 'прятать уведомления',
  'notifications:hide:all': 'прятать все уведомления',
  'notifications:list': 'список уведомлений',
  'notifications:read': 'помечать уведомления как прочитанные',
  'notifications:read:all': 'помечать все уведомления как прочитанные',
  'notifications:subscribe': 'подписка на уведомления',
  'post': 'все действия с постами',
  'post:bookmark': 'отслеживать посты',
  'post:comment': 'комментировать в постах',
  'post:create': 'создавать посты',
  'post:edit': 'редактировать посты',
  'post:edit-comment': 'редактировать комментарии',
  'post:get': 'получать посты',
  'post:get-comment': 'получать комментарии поста',
  'post:get-public-key': 'получать публичный ключ автора поста',
  'post:history': 'смотреть историю редактирования поста',
  'post:preview': 'проевью поста',
  'post:read': 'помеяать посты как прочитанные',
  'post:translate': 'переводить посты',
  'post:watch': 'следить за постами',
  'search': 'искать по сайту',
  'site': 'все действия с сайтами',
  'site:create': 'создавать сайты',
  'site:list': 'получать список сайтов',
  'site:subscribe': 'подписываться на сайты',
  'site:subscriptions': 'получать список подписок на сайты',
  'status': 'получать статус',
  'user': 'все действия с пользователем',
  'user:comments': 'получать комментарии пользователя',
  'user:karma': 'получать детали кармы пользователя',
  'user:posts': 'получать посты пользователя',
  'user:profile': 'получать профиль пользователя',
  'user:restrictions': 'получать ограничения пользователя',
  'user:save-public-key': 'менять публичный ключ пользователя',
  'user:savebio': 'менять био пользователя',
  'user:savegender': 'менять пол пользователя',
  'user:savename': 'менять имя пользователя',
  'user:suggest-username': 'искать юзернейм пользователя',
  'vote': 'все действия с голосами',
  'vote:list': 'получать список голосов',
  'vote:set': 'голосовать'
};
