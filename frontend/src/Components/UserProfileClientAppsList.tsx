import React from 'react';
import styles from './UserProfileClientApps.module.scss';
import { OAuth2ClientEntity } from '../Types/OAuth2';
import OAuth2AppCardComponent from './OAuth2AppCardComponent';

type UserProfileClientAppsListProps = {
  list: OAuth2ClientEntity[];
  onNewClientCreated?: (newClient?: OAuth2ClientEntity) => void;
  onClientSecretUpdate?: (newSecret: string) => void;
  onClientUnauthorize?: () => void;
  onClientPublish?: () => void;
  onClientEdit?: () => void;
};

export default function UserProfileClientAppsList(props: UserProfileClientAppsListProps) {
    const {list} = props;

    return <div className={styles.appsListContainer}>
        {list.length === 0 && 'Тут пока ничего нет.'}
        {list.map((client) => (
            <OAuth2AppCardComponent
                key={client.clientId}
                client={client}
                onClientSecretUpdate={props?.onClientSecretUpdate}
                onClientUnauthorize={props?.onClientUnauthorize}
                onClientChangeVisibility={props?.onClientPublish}
                authorizedScopes={client.scopes}
                onClientEdited={props?.onClientEdit}
            />
        ))}
    </div>;
}
