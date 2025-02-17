import React from 'react';
import styles from './UserProfileClientApps.module.scss';
import {OAuth2ClientEntity} from '../Types/OAuth2';
import {OAuth2AppCardSummaryComponent} from './OAuth2AppCardSummaryComponent';
import {OAuth2AppCardModalComponent} from './OAuth2AppCardModalComponent';
import {useAppState} from '../AppState/AppState';


type UserProfileClientAppsListProps = {
    list: OAuth2ClientEntity[];
    onNewClientCreated?: (newClient?: OAuth2ClientEntity) => void;
    onClientSecretUpdate?: (clientId: string, newSecret: string) => void;
    onClientUpdate?: (updatedClient?: OAuth2ClientEntity) => void;
    onClientDelete?: (deletedClientId: string) => void;
};

export default function UserProfileClientAppsList(props: UserProfileClientAppsListProps) {
    const {list} = props;
    const appState = useAppState();

    const handleFullView = (client: OAuth2ClientEntity) => {
        appState.setModal(
            <OAuth2AppCardModalComponent
                client={client}
                onClose={() => appState.setModal(undefined)}
                onClientSecretUpdate={props?.onClientSecretUpdate}
                onClientUpdate={(newClient) => {
                    props.onClientUpdate?.(newClient);
                    handleFullView(newClient);
                }}
                onClientDelete={(deletedClientId) => {
                    props.onClientDelete?.(deletedClientId);
                }}
            />
        );
    };

    return <div className={styles.appsListContainer}>
        {list.length === 0 && 'Тут пока ничего нет.'}
        {list.map((client) => (
            <div className={'oauth-app'} key={client.clientId}>
            <OAuth2AppCardSummaryComponent
                client={client}
                onOpenFullView={() => handleFullView(client)}
            /></div>
        ))}
    </div>;
}
