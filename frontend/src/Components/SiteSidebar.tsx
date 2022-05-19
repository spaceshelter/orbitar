import styles from './SiteSidebar.module.css';
import {Link} from 'react-router-dom';
import React, {useState} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';

export const SiteSidebar = observer(() => {
    const [subsDisabled, setSubsDisabled] = useState(false);
    const api = useAPI();
    const {siteInfo, userStatus} = useAppState();

    if (!siteInfo) {
        return <></>;
    }

    const handleSubscribe = (subscribe: boolean) => {
        setSubsDisabled(true);
        api.site.subscribe(siteInfo.site, subscribe, false)
            .then(() => {
                setSubsDisabled(false);
            })
            .catch(() => {
                setSubsDisabled(false);
                toast.error('Настройки подписки не изменены!');
            });
    };

    return (<div className={styles.container}>
        <div className={styles.fixed}>
            <Link className={styles.siteName} to={'/'}> {siteInfo.name}</Link>
            {siteInfo.site !== 'main' &&
            <div className={styles.subscribe}>
                {siteInfo.subscribe?.main ?
                    <button className={styles.subscribed} disabled={subsDisabled} onClick={() => handleSubscribe(false)}>Отписаться</button>
                    :
                    <button className={styles.notSubscribed} disabled={subsDisabled} onClick={() => handleSubscribe(true)}>Подписаться</button>
                }
            </div>}
            <div className={styles.podsites}>
                { userStatus.subscriptions.map(site => {
                    return <div key={site.site}><Link to={site.site === 'main' ? '/' : `/s/${site.site}`}>{site.name}</Link></div>;
                }) }
            </div>
        </div>
    </div>);
});
