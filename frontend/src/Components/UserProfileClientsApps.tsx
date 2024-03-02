import styles from './UserProfileClientApps.module.scss';
import { useAPI } from '../AppState/AppState';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import UserProfileClientAppsList from './UserProfileClientAppsList';
import buttonStyles from './Buttons.module.scss';
import mediaFormStyles from './MediaUploader.module.scss';
import UserProfileClientAppsCreateForm from './UserProfileClientAppsCreateForm';
import Overlay from './Overlay';
import { selectElementText } from '../Utils/utils';
import classNames from 'classnames';
import { OAuth2ClientEntity } from '../Types/OAuth2';

interface UserProfileClientsAppsProps {
  onClientUnauthorized?: () => void;
}

export default function UserProfileClientsApps(props: UserProfileClientsAppsProps) {
  const api = useAPI();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<OAuth2ClientEntity[]>([]);
  const [lastClientCreatedSecretCode, setLastClientCreatedSecretCode] = useState<string | undefined>(undefined);
  const [lastClientCreatedClientId, setLastClientCreatedClientId] = useState<string | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const copyButtonLabel = 'скопировать в буфер';
  const [copyLastClientCreatedSecretCodeLabel, setCopyLastClientCreatedSecretCodeLabel] = useState(copyButtonLabel);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.oauth2Api.listClients().then((data) => {
      setClients(data.clients);
      setLoading(false);
    }).catch((err) => {
      toast.error('Не удалось загрузить список приложений');
    }).finally(() => {
      setLoading(false);
    });
  }, [reload]);

  const handleClientSecretUpdate = (newSecret: string) => {
    setLastClientCreatedSecretCode(newSecret);
  };

  const handleClientUnauthorized = () => {
    setReload(reload + 1);
  };

  const handleClientPublish = () => {
    setReload(reload + 1);
  };

  const handleCreatedClient = (newClient?: OAuth2ClientEntity) => {
    if (newClient) {
      setCreating(false);
      setLastClientCreatedSecretCode(newClient.clientSecretOriginal);
      setLastClientCreatedClientId(newClient.clientId);
      setClients([...clients, newClient]);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (lastClientCreatedSecretCode === undefined) {
      return;
    }
    navigator.clipboard?.writeText(lastClientCreatedSecretCode)
      ?.then(() => {
        setCopyLastClientCreatedSecretCodeLabel('скопировано!');
        setTimeout(() => {
          setCopyLastClientCreatedSecretCodeLabel(copyButtonLabel);
        }, 5000);
      });
  };

  const authorizedClients = clients.filter((client) => client.isAuthorized);
  const otherClients = clients.filter((client) => !client.isAuthorized);
  return (
    <div className={styles.appsContainer}>
      {
        lastClientCreatedSecretCode && (
        <div className={styles.clientSecretCopyContainer}>
          <Overlay onClick={() => { setLastClientCreatedSecretCode(undefined); }} />
          <div className={classNames([mediaFormStyles.container, styles.clientSecretCopyContainer])}>
            <h3>Приложение зарегистрировано!</h3>
            <div>
              <b>ID вашего приложения (client_id)</b>
              <span className={styles.clientId}>{lastClientCreatedClientId}</span>
            </div>
            <div>
              <b>Секретный код приложения</b>
              <span className={styles.code} onClick={selectElementText}>{lastClientCreatedSecretCode}</span>
              <span className={styles.codeInfo}>
                Скопируйте ID приложения (client_id) и секретный код и сохраните эти данные в надёжном месте.<br />
                Мы храним секретные коды в зашифрованном виде и не можем их восстановить.<br /><br />
                Правда, вы сможете перегенерировать его в любое время,
                но тогда вам также придётся обновить код в своём приложении.
              </span>
              <button className={buttonStyles.linkButton} onClick={handleCopy}>{copyLastClientCreatedSecretCodeLabel}</button>
              <span className={styles.clientSecret}>{}</span>
            </div>
          </div>
        </div>
        )
      }
      {loading && <span>Loading...</span>}
      <UserProfileClientAppsList
        onClientSecretUpdate={handleClientSecretUpdate}
        onClientUnauthorize={handleClientUnauthorized}
        onClientPublish={handleClientPublish}
        list={authorizedClients}
        isAuthorized={true}
      />
      <UserProfileClientAppsList
        onClientSecretUpdate={handleClientSecretUpdate}
        onClientUnauthorize={handleClientUnauthorized}
        onClientPublish={handleClientPublish}
        list={otherClients}
        isAuthorized={false}
      />

      <div className={styles.forDevContainer}>
        <h4>Для разработчиков</h4>
        <button {...(creating && { disabled: true })} className={buttonStyles.linkButton} onClick={() => {
          setCreating(true);
        }}>Зарегистрировать своё приложение
        </button>
        {creating && (
          <>
            <Overlay onClick={() => { setCreating(false); }}/>
            <div className={styles.createAppContainer}>
              <UserProfileClientAppsCreateForm onClientRegisterSuccess={handleCreatedClient} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
