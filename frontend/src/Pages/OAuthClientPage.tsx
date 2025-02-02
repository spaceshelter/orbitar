import React, {useEffect} from 'react';
import styles from './OAuthClientPage.module.scss';
import {observer} from 'mobx-react-lite';
import {useAPI} from '../AppState/AppState';
import {OAuth2ClientEntity} from '../Types/OAuth2';
import OAuth2AppCardComponent from '../Components/OAuth2AppCardComponent';
import Cookies from 'js-cookie';

export const OAuthClientPage = observer(() => {
    const api = useAPI();
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const clientId = urlParams.get('client_id') || '';
    const scope = urlParams.get('scope') || 'openid';
    const responseType = urlParams.get('response_type') || 'code';
    const redirectUri = urlParams.get('redirect_uri') || '';
    const state = urlParams.get('state') || '';

    const sessionId = Cookies.get('session') || '';

    const [error, setError] = React.useState<string | null>(null);
    const [client, setClient] = React.useState<OAuth2ClientEntity | null>(null);

    const validateRedirectUri = (url: string, allowedRedirectUris: string): boolean => {
        const allowedUrls = allowedRedirectUris.split(',').map(u => u.trim());

        for (const allowedUrl of allowedUrls) {
            if (allowedUrl.endsWith('/*')) {
                const baseUrl = allowedUrl.slice(0, -1); // Remove the '*' character
                if (url.startsWith(baseUrl)) {
                    return true;
                }
            } else {
                if (url === allowedUrl) {
                    return true;
                }
            }
        }
        return false;
    };

    const onDecline = () => {
        window.history.back();
    };

    useEffect(() => {
        if (!clientId || !scope || !responseType || !redirectUri) {
            return;
        }
        api.oauth2Api.getClient(clientId).then((data) => {
            if (!validateRedirectUri(redirectUri, data.client.redirectUris)) {
                setError('Невалидный redirect_uri');
                return;
            }
            setClient(data.client);
        }).catch((err) => {
            setError(err.message);
        });
    }, []);

    if (!state || clientId === '' || !responseType || !redirectUri || !scope) {
        return (<div className={styles.container}>
            Невалидный запрос. Отсутствуют следующие параметры: <br/>
            {!clientId && <div><strong>client_id</strong></div>}
            {!scope && <div><strong>scope</strong></div>}
            {!responseType && <div><strong>response_type</strong></div>}
            {!redirectUri && <div><strong>redirect_uri</strong></div>}
            {!state && <div><strong>state</strong></div>}
        </div>);
    }

    if (error) {
        return (
            <div className={styles.container}>
                {error}
            </div>
        );
    }

    if (!client) {
        return (
            <div className={styles.container}>
                Загрузка...
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h2>Авторизация приложения</h2>
            <OAuth2AppCardComponent
                client={client}
                scope={scope}
                redirectUri={redirectUri}
                state={state}
                sessionId={sessionId}
                onAuthorizeDeny={onDecline}
            />
        </div>
    );
});
