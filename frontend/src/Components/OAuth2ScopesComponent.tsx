import styles from './OAuth2ScopesComponent.module.scss';

type Scope = {
  name: string;
  description: string;
  onByDefault: boolean;
  canChange: boolean;
  warningNote?: string;
};

const scopes: Scope[] = [
  {
    name: 'openid',
    description: 'доступ к вашему аккаунту. Приложение узнает ваш юзернейм и id. Без этого приложение не сможет получить доступ к сайту и не будет работать.',
    onByDefault: true,
    canChange: false
  },
  {
    name: 'feed:all',
    description: 'приложение сможет читать фид /all.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'feed:subscriptions',
    description: 'приложение сможет читать фид ваших подписок.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'feed:posts',
    description: 'приложение сможет читать фид постов.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'feed:watch',
    description: 'приложение сможет читать фид постов, которые вы отслеживаете.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'notifications:read',
    description: 'приложение сможет видеть ваши уведомления.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'notifications:write',
    description: 'приложение сможет помечать уведомления как прочитанные и очищать уведомления.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'posts:read',
    description: 'приложение сможет читать посты, которые доступны вам.',
    onByDefault: false,
    canChange: true,
    warningNote: 'приложение <b>НЕ СМОЖЕТ читать шифровки</b>. Подробнее о том, как работают шифровки, можно почитать <a href="https://orbitar.space/p16835">тут</a>'
  },
  {
    name: 'posts:write',
    description: 'приложение сможет писать и редактировать посты от вашего имени.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'comments:read',
    description: 'приложение сможет читать комментарии, которые доступны вам.',
    onByDefault: false,
    canChange: true,
    warningNote: 'приложение <b>НЕ СМОЖЕТ читать шифровки</b>. Подробнее о том, как работают шифровки, можно почитать <a href="https://orbitar.space/p16835">тут</a>'
  },
  {
    name: 'comments:write',
    description: 'приложение сможет писать и редактировать комментарии от вашего имени, только в постах, которые доступны вам.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'media:upload',
    description: 'приложение сможет загружать картинки и видео от вашего имени.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'vote:read',
    description: 'приложение сможет видеть голоса за посты и комментарии.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'vote:write',
    description: 'приложение сможет голосовать за посты и комментарии от вашего имени.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'karma:read',
    description: 'приложение сможет видеть карму пользователей.',
    onByDefault: false,
    canChange: true
  },
  {
    name: 'karma:write',
    description: 'приложение сможет изменять карму пользователей от вашего имени.',
    onByDefault: false,
    canChange: true
  }
];

function ScopeControl(props: { scope: Scope, checked: boolean }) {
  return (
    <label>
      <input
        type={'checkbox'} {...(props.checked ? { defaultChecked: true } : {})} {...(!props.scope.canChange ? { disabled: true } : {})}
        name={props.scope.name}/>
      <span>
        <b>{props.scope.name}</b> - {props.scope.description}
        {props.scope.warningNote && <><br/><span className={styles.warningNote} dangerouslySetInnerHTML={{ __html: props.scope.warningNote }}></span></>}
      </span>

    </label>
  );
}

export default function OAuth2ScopesComponent(props: { appRequests: string | null }) {
  const requestedScopesNames = ['openid'].concat(props.appRequests?.split(',').map(s => s.trim()) || []);

  return (<div className={styles.container}>
    {
      scopes.map((scope: Scope) => {
        if ((scope.onByDefault && !scope.canChange) || (requestedScopesNames && requestedScopesNames.includes(scope.name))) {
          return (<ScopeControl key={scope.name} scope={scope} checked={scope.onByDefault || requestedScopesNames.includes(scope.name)}/>);
        }
      })
    }
  </div>);
}
