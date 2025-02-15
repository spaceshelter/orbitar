import styles from './OAuth2AppCardComponent.module.scss';
import OAuth2ClientLogoComponent from './OAuth2ClientLogoComponent';
import Username from './Username';
import OAuth2ScopesComponent from './OAuth2ScopesComponent';
import classNames from 'classnames';
import buttonStyles from './Buttons.module.scss';
import React, {MouseEvent} from 'react';
import {OAuth2ClientEntity} from '../Types/OAuth2';
import {confirmAlert} from 'react-confirm-alert';
import {toast} from 'react-toastify';
import {useAPI, useAppState} from '../AppState/AppState';
import APIBase from '../API/APIBase';
import Overlay from './Overlay';
import UserProfileClientAppsCreateForm from './UserProfileClientAppsCreateForm';
import createFormStyles from './UserProfileClientApps.module.scss';

interface OAuthEmbeddedAppComponentProps {
  clientId: string;
}

export function OAuthEmbeddedAppComponent(props: OAuthEmbeddedAppComponentProps) {
    const api = useAPI();
    const [client, setClient] = React.useState<OAuth2ClientEntity | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        api.oauth2Api.getClient(props.clientId).then((data) => {
            setClient(data.client);
        }).catch(() => {
            setError('Произошла ужасная ошибка!');
        });
    }, [props.clientId]);

    if (error) {
        return <div>{error}</div>;
    }
    if (!client) {
        return <div>Загрузка...</div>;
    } else {
        return <OAuth2AppCardComponent client={client} embedded={true} />;
    }
}

interface OAuthAppCardComponentProps {
  client: OAuth2ClientEntity;
  // scopes that are requested by the new authorization
  newlyRequestedScopes?: string;
  // scopes that were previously authorized
  authorizedScopes?: string;
  redirectUri?: string;
  state?: string;
  sessionId?: string;
  onAuthorizeProceed?: () => void;
  onAuthorizeDeny?: () => void;
  onClientSecretUpdate?: (newSecret: string) => void;
  onClientUnauthorize?: () => void;
  onClientChangeVisibility?: () => void;
  onClientEdited?: () => void;
  embedded?: boolean;
}

export default function OAuth2AppCardComponent(props: OAuthAppCardComponentProps) {
  const api = useAPI();
  const { client, newlyRequestedScopes, authorizedScopes } = props;
  const { userInfo } = useAppState();
  const userId = userInfo?.id;
  const shouldShowManagementControls = client.author.id === userId && !props.embedded && !newlyRequestedScopes;
  const [showCurrentScopes, setShowCurrentScopes] = React.useState(false);
  const embedCode = `<app>${client.clientId}</app>`;
  const [editing, setEditing] = React.useState(false);

  const handleInstallClick = () => {
    if (client.initialAuthorizationUrl) {
      window.open(client.initialAuthorizationUrl, '_blank');
    }
  };

  const confirmAction = (title: string, message: string, action: () => void) => {
    confirmAlert({
      title,
      message,
      buttons: [
        {
          label: 'Да!',
          onClick: action,
        },
        {
          label: 'Отмена',
          className: 'cancel',
        },
      ],
      overlayClassName: 'orbitar-confirm-overlay',
    });
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleClientSecretUpdate = () => {
    const message =
      'Вы уверены, что хотите перегенерировать секретный код вашего приложения? Не забудьте потом обновить настройки вашего приложения, т.к. старый секретный код перестанет работать.';
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .regenerateClientSecret(client.clientId)
        .then((data) => {
          props.onClientSecretUpdate?.(data.newSecret);
        })
        .catch(() => {
          toast.error('Не удалось перегенерировать секретный код приложения');
        })
    );
  };

  const handleClientDelete = () => {
    const message =
      'Вы уверены, что хотите удалить приложение? Для всех пользователей, подключивших ваше приложение, оно перестанет работать.';
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .deleteClient(client.clientId)
        .then(() => {
          props.onClientUnauthorize?.();
        })
        .catch(() => {
          toast.error('Не удалось удалить приложение');
        })
    );
  };

  const handleUnInstallClick = () => {
    const message =
      'Вы уверены, что хотите отключить приложение? В принципе, это не страшно, потом сможете добавить его снова.';
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .unauthorizeClient(client.clientId)
        .then(() => {
          props.onClientUnauthorize?.();
        })
        .catch(() => {
          toast.error('Не удалось отключить приложение');
        })
    );
  };

  const handleNewLogo = (url: string) => {
    api.oauth2Api
      .updateClientLogo(client.clientId, url)
      .then(() => {
        // Optionally update the UI or signal success.
      })
      .catch(() => {
        toast.error('Не удалось обновить логотип');
      });
  };

  const handleCopyEmbedCode = (e: MouseEvent) => {
      e.preventDefault();

      // select the text
      const embedCodeElement = e.currentTarget as HTMLDivElement;
      const range = document.createRange();
      range.selectNodeContents(embedCodeElement);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      navigator.clipboard?.writeText(embedCode)
          ?.then(() => {
              toast.success('Код вставки скопирован в буфер обмена');
          }).catch(() => {
          toast.error('Не удалось скопировать код вставки');
      });
  };

  return (
    <div
      className={classNames({
        [styles.appCard]: true,
        [styles.inCatalog]: !newlyRequestedScopes
      })}
    >
      <div className={styles.nameContainer}>
        {newlyRequestedScopes ? 'Приложение ' : ''}
        <h3 className={styles.name}>
          {client.name}{' '}
          {!shouldShowManagementControls && (
            <>
              от&nbsp;
              <Username className={styles.author} user={client.author} />
            </>
          )}
        </h3>
        {newlyRequestedScopes ? ' запрашивает доступ к вашему аккаунту.' : ''}
      </div>
      <div className={styles.logoContainer}>
        <OAuth2ClientLogoComponent url={client.logoUrl} canManage={shouldShowManagementControls} onNewLogo={handleNewLogo} />
      </div>

      {
        client.installationsCount !== undefined &&
        <div className={styles.installationsCountContainer}>
          <span>
            {client.installationsCount === 0 && 'Пока никто не подключал.'}
            {client.installationsCount > 0 && <><b>Подключений</b>: {client.installationsCount}</>}
          </span>
        </div>
      }


      {shouldShowManagementControls && (
          <div className={classNames([styles.buttonsContainer, styles.ownerButtons])}>
            <button onClick={handleEdit} className={buttonStyles.linkButton}>
              редактировать
            </button>
            <button onClick={handleClientSecretUpdate} className={buttonStyles.linkButton}>
              обновить секрет
            </button>
            <button onClick={handleClientDelete} className={classNames(buttonStyles.linkButton, buttonStyles.danger)}>
              удалить
            </button>
          </div>
      )}

      <div className={styles.descriptionContainer}>
        <p className={styles.description}>{client.description}</p>
      </div>

      <div className={styles.buttonsContainer}>
        {!authorizedScopes && !newlyRequestedScopes && client.initialAuthorizationUrl && (
          <button
            onClick={handleInstallClick}
            className={classNames({
              [buttonStyles.settingsButton]: true,
              [buttonStyles.positiveButton]: true,
              [buttonStyles.bigger]: !!newlyRequestedScopes,
            })}
          >Подключить
          </button>
        )}
        {!!authorizedScopes && (
            <>
              {showCurrentScopes && (
                  <div className={styles.scopeContainer}>
                    <h3>Что доступно приложению:</h3>
                    <OAuth2ScopesComponent appRequests={authorizedScopes}/>
                  </div>
              )}

              <button className="button" type='button'
                      onClick={(e) => {
                        e.preventDefault();
                        setShowCurrentScopes(!showCurrentScopes);
                      }}><span className={classNames('i', 'i-info')}></span>Инфо
              </button>
              <button
                onClick={handleUnInstallClick}
                  className={classNames({
                    [buttonStyles.settingsButton]: true,
                  })}>Отключить
              </button>
            </>
        )}
      </div>

      {!newlyRequestedScopes && (
          <>
            <div className={styles.embedCodeHeader}>
              <h4>Код вставки:</h4>
            </div>
            <div className={styles.embedCodeContainer} onClick={handleCopyEmbedCode}>
              {embedCode}
            </div>
          </>
      )}

      {newlyRequestedScopes && (
        <>
          <div className={styles.scopeContainer}>
            <h3>Что будет доступно приложению:</h3>
            <div>
              <OAuth2ScopesComponent appRequests={newlyRequestedScopes}/>
            </div>
            <div className={styles.consentDisclaimer}>
              Внимание! Приложение <b>не сможет писать или читать шифровки</b>.
              Подробнее о том, как работают шифровки, можно почитать{' '}
              <a href="https://orbitar.space/p16835">тут</a>
            </div>
          </div>
          <form className={styles.buttonsContainer} method="POST" action={APIBase.endpoint + '/oauth2/authorize'}>
            <input type="hidden" name="scope" value={props.newlyRequestedScopes}/>
            <input type="hidden" name="state" value={props.state}/>
            <input type="hidden" name="client_id" value={client.clientId} />
            <input type="hidden" name="redirect_uri" value={props.redirectUri} />
            <input type="hidden" name="X-Session-Id" value={props.sessionId} />
            <input type="hidden" name="response_type" value="code" />

            <button
              type="submit"
              className={classNames({
                [buttonStyles.settingsButton]: true,
                [buttonStyles.positiveButton]: true,
                [buttonStyles.bigger]: true,
              })}
            >
              Да, меня это устраивает
            </button>
            <button className={classNames([buttonStyles.settingsButton, buttonStyles.cancelButton])} onClick={props.onAuthorizeDeny}>
              Нет, лучше не надо
            </button>
          </form>
        </>
      )}

      {editing && (
          <>
            <Overlay onClick={() => { setEditing(false); }}/>
            <div className={createFormStyles.createAppContainer}>
              <UserProfileClientAppsCreateForm
                editingClient={client}
                onClientEditSuccess={() => {
                  setEditing(false);
                  if (props.onClientEdited) {
                    props.onClientEdited();
                  }
                }}
              />
            </div>
          </>
      )}
    </div>
  );
}