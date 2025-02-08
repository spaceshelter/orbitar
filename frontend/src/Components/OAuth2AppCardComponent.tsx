import styles from './OAuth2AppCardComponent.module.scss';
import OAuth2ClientLogoComponent from './OAuth2ClientLogoComponent';
import Username from './Username';
import OAuth2ScopesComponent from './OAuth2ScopesComponent';
import classNames from 'classnames';
import buttonStyles from './Buttons.module.scss';
import React from 'react';
import { OAuth2ClientEntity } from '../Types/OAuth2';
import { confirmAlert } from 'react-confirm-alert';
import { toast } from 'react-toastify';
import { useAPI } from '../AppState/AppState';
import APIBase from '../API/APIBase';

interface OAuthAppCardComponentProps {
  client: OAuth2ClientEntity;
  scope?: string;
  redirectUri?: string;
  state?: string;
  sessionId?: string;
  onAuthorizeProceed?: () => void;
  onAuthorizeDeny?: () => void;
  onClientSecretUpdate?: (newSecret: string) => void;
  onClientUnauthorize?: () => void;
  onClientChangeVisibility?: () => void;
}

export default function OAuth2AppCardComponent(props: OAuthAppCardComponentProps) {
  const api = useAPI();
  const { client, scope } = props;

  const handleInstallClick = () => {
    if (client.initialAuthorizationUrl) {
      window.location.href = client.initialAuthorizationUrl;
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
      'Вы уверены, что хотите удалить приложение? Для всех пользователей, авторизовавших ваше приложение, оно перестанет работать.';
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
      'Вы уверены, что хотите отозвать авторизацию приложения? В принципе, это не страшно, потом сможете добавить его снова.';
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .unauthorizeClient(client.clientId)
        .then(() => {
          props.onClientUnauthorize?.();
        })
        .catch(() => {
          toast.error('Не удалось отозвать авторизацию приложения');
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

  return (
    <div
      className={classNames({
        [styles.appCard]: true,
        [styles.inCatalog]: !scope,
        [styles.isMy]: client.isMy,
      })}
    >
      <div className={styles.nameContainer}>
        {scope ? 'Приложение ' : ''}
        <span className={styles.name}>
          {client.name}{' '}
          {!client.isMy && (
            <>
              от&nbsp;
              <Username className={styles.author} user={client.author} />
            </>
          )}
        </span>
        {scope ? ' запрашивает доступ к вашему аккаунту.' : ''}
      </div>
      <div className={styles.logoContainer}>
        <OAuth2ClientLogoComponent url={client.logoUrl} isMy={!!client.isMy && !scope} onNewLogo={handleNewLogo} />
      </div>

      {client.isMy && !scope && (
        <div className={classNames([styles.buttonsContainer, styles.ownerButtons])}>
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
        {!scope && client.initialAuthorizationUrl && !client.isAuthorized && (
          <button
            onClick={handleInstallClick}
            className={classNames({
              [buttonStyles.settingsButton]: true,
              [buttonStyles.positiveButton]: true,
              [buttonStyles.bigger]: !!scope,
            })}
          >
            Установить
          </button>
        )}
        {client.isAuthorized && (
          <button
            onClick={handleUnInstallClick}
            className={classNames({
              [buttonStyles.settingsButton]: true,
            })}
          >
            Отозвать авторизацию
          </button>
        )}
      </div>
      {scope && (
        <>
          <div className={styles.scopeContainer}>
            <h3>Что будет доступно приложению:</h3>
            <div className={styles.consentDisclaimer}>
              Внимание! Приложение <b>не сможет писать или читать шифровки</b>.
              Подробнее о том, как работают шифровки, можно почитать{' '}
              <a href="https://orbitar.space/p16835">тут</a>
            </div>
            <div>
              <OAuth2ScopesComponent appRequests={scope} />
            </div>
          </div>
          <form className={styles.buttonsContainer} method="POST" action={APIBase.endpoint + '/oauth2/authorize'}>
            <input type="hidden" name="scope" value={props.scope} />
            <input type="hidden" name="state" value={props.state} />
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
    </div>
  );
}