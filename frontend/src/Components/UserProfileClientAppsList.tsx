import React from 'react';
import styles from './UserProfileClientApps.module.scss';
import { OAuth2ClientEntity } from '../Types/OAuth2';
import OAuth2AppCardComponent from './OAuth2AppCardComponent';

type UserProfileClientAppsListProps = {
  list: OAuth2ClientEntity[];
  isAuthorized: boolean;
  onNewClientCreated?: (newClient?: OAuth2ClientEntity) => void;
  onClientSecretUpdate?: (newSecret: string) => void;
  onClientUnauthorize?: () => void;
  onClientPublish?: () => void;
};

export default function UserProfileClientAppsList(props: UserProfileClientAppsListProps) {
    const {list, isAuthorized} = props;
    if (isAuthorized && !list.length) {
        return <></>;
    }

    return <div className={styles.appsListContainer}>
        <div className={styles.appListHeaderContainer}>
            <h2>{isAuthorized ? 'Установленные приложения' : 'Каталог приложений'}</h2>
        </div>
        {list.length === 0 &&
            <div>{isAuthorized ? 'Вы пока не установили ни одного приложения.' : 'Тут пока ничего нет.'}</div>}

        {list.map((client) => (
            <OAuth2AppCardComponent
                client={client}
                key={client.id}
                onClientSecretUpdate={props?.onClientSecretUpdate}
                onClientUnauthorize={props?.onClientUnauthorize}
                onClientChangeVisibility={props?.onClientPublish}
            />
        ))}
    </div>;
}
