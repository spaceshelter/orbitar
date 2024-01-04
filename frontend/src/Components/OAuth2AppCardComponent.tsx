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

interface OAuthAppCardComponentProps {
  client: OAuth2ClientEntity;
  scope?: string;
  onAuthorizeProceed?: () => void;
  onAuthorizeDeny?: () => void;
  onClientSecretUpdate?: (newSecret: string) => void;
  onClientUnauthorize?: () => void;
  onClientChangeVisibility?: () => void;
  submitting?: boolean;
}

export default function OAuth2AppCardComponent(props: OAuthAppCardComponentProps) {
  const api = useAPI();

  const handleInstallClick = () => {
    if (client.initialAuthorizationUrl) {
      window.location.href = client.initialAuthorizationUrl;
    }
  };

  const changeVisibility = () => {
    confirmAlert({
      title: 'Астанавитесь!',
      message: `Вы уверены, что хотите ${client.isPublic ? 'спрятать' : 'опубликовать'} ваше приложение? ${!client.isPublic ? 'После публикации приложение увидят другие пользователи и смогут использовать его.' : 'Пользователи, которые установили приложение, всё равно смогут им пользоваться.'}`,
      buttons: [
        {
          label: 'Да!',
          onClick: () => {
            api.oauth2Api.changeVisibility(client.id).then(() => {
              props.onClientChangeVisibility?.();
            }).catch(() => {
              toast.error('Не удалось перегенерировать секретный код приложения');
            });
          }
        },
        {
          label: 'Отмена',
          className: 'cancel'
        }
      ],
      overlayClassName: 'orbitar-confirm-overlay'
    });
  };

  const handleClientSecretUpdate = () => {
    confirmAlert({
      title: 'Астанавитесь!',
      message: 'Вы уверены, что хотите перегенерировать секретный код вашего приложения? Не забудьте потом обновить настройки вашего приложения, т.к. старый секретный код перестанет работать.',
      buttons: [
        {
          label: 'Да!',
          onClick: () => {
            api.oauth2Api.regenerateClientSecret(client.id).then((data) => {
              props.onClientSecretUpdate?.(data.newSecret);
            }).catch(() => {
              toast.error('Не удалось перегенерировать секретный код приложения');
            });
          }
        },
        {
          label: 'Отмена',
          className: 'cancel'
        }
      ],
      overlayClassName: 'orbitar-confirm-overlay'
    });
  };

  const handleClientDelete = () => {
    confirmAlert({
      title: 'Астанавитесь!',
      message: 'Вы уверены, что хотите удалить приложение? Для всех пользователей, авторизовавших ваше приложение, оно перестанет работать.',
      buttons: [
        {
          label: 'Да!',
          onClick: () => {
            api.oauth2Api.deleteClient(client.id).then(() => {
              props.onClientUnauthorize?.();
            }).catch(() => {
              toast.error('Не удалось удалить приложение');
            });
          }
        },
        {
          label: 'Отмена',
          className: 'cancel'
        }
      ],
      overlayClassName: 'orbitar-confirm-overlay'
    });
  };

  const handleUnInstallClick = () => {
    confirmAlert({
      title: 'Астанавитесь!',
      message: 'Вы уверены, что хотите отозвать авторизацию приложения? В принципе, это не страшно, потом сможете добавить его снова.',
      buttons: [
        {
          label: 'Да!',
          onClick: () => {
            api.oauth2Api.unauthorizeClient(client.id).then(() => {
              props.onClientUnauthorize?.();
            }).catch((err) => {
              toast.error('Не удалось отозвать авторизацию приложения');
            });
          }
        },
        {
          label: 'Отмена',
          className: 'cancel'
        }
      ],
      overlayClassName: 'orbitar-confirm-overlay'
    });
  };

  const handleNewLogo = (url: string) => {
    api.oauth2Api.updateClientLogo(client.id, url).then(() => {

    }).catch(() => {
      toast.error('Не удалось обновить логотип');
    });
  };

  const { client, scope } = props;

  return (<div className={classNames({[styles.appCard]: true, [styles.inCatalog]: !scope, [styles.isMy]: client.isMy})}>
    <div className={styles.nameContainer}>
      {scope ? 'Приложение ' : ''}
      <span className={styles.name}>{client.name}</span>
      {scope ? ' запрашивает доступ к вашему аккаунту.' : ''}
    </div>
    <div className={styles.logoContainer}>
      <OAuth2ClientLogoComponent url={client.logoUrl} isMy={!!client.isMy} onNewLogo={handleNewLogo} />
    </div>

    {/*TODO: show client id*/}

    {client.isMy &&
      <div className={classNames([styles.buttonsContainer, styles.ownerButtons])}>
        <button onClick={handleClientSecretUpdate} className={buttonStyles.linkButton}>обновить секрет</button>
        <button onClick={handleClientSecretUpdate} className={buttonStyles.linkButton}>обновить лого</button>
        <button onClick={handleClientDelete} className={classNames(buttonStyles.linkButton, buttonStyles.danger)}>удалить</button>
        {
          client.isPublic &&
          <button onClick={changeVisibility} className={classNames(buttonStyles.linkButton, buttonStyles.danger)}>спрятать</button>
        }
        {
          !client.isPublic &&
          <button onClick={changeVisibility} className={classNames(buttonStyles.linkButton, buttonStyles.danger)}>опубликовать</button>
        }
      </div>
    }

    <div className={styles.descriptionContainer}>
      <h3>Описание от автора <Username className={styles.author} user={client.author} /></h3>
      <p className={styles.description}>
        {client.description}
      </p>
    </div>

    <div className={styles.buttonsContainer}>
      {
        !scope && client.initialAuthorizationUrl && !client.isAuthorized &&
        <button onClick={handleInstallClick} className={classNames({
          [buttonStyles.settingsButton]: true,
          [buttonStyles.positiveButton]: true,
          [buttonStyles.bigger]: !!scope
        })}>Установить</button>
      }
      {
        client.isAuthorized &&
        <button
          onClick={handleUnInstallClick}
          className={classNames({
            [buttonStyles.settingsButton]: true
          })}>
          Отозвать авторизацию
        </button>
      }
    </div>
    {
      scope && <>
        <div className={styles.scopeContainer}>
          <h3>Что будет доступно приложению:</h3>
          <div className={styles.consentDisclaimer}>
            Внимание! Приложение <b>не сможет писать или читать шифровки</b>. Подробнее о том, как работают шифровки, можно почитать <a href="https://orbitar.space/p16835">тут</a>
          </div>
          <div>
            <OAuth2ScopesComponent appRequests={scope}/>
          </div>
        </div>
        <div className={styles.buttonsContainer}>
          <button className={classNames({
            [buttonStyles.settingsButton]: true,
            [buttonStyles.positiveButton]: true,
            [buttonStyles.disabled]: props.submitting,
            [buttonStyles.bigger]: true
          })} onClick={props.onAuthorizeProceed}>Да, меня это
            устраивает
          </button>
          <button className={classNames([buttonStyles.settingsButton, buttonStyles.cancelButton])}
                  onClick={props.onAuthorizeDeny}>Нет, лучше не надо
          </button>
        </div>
      </>
    }
  </div>);
}