import styles from './SiteSidebar.module.css';
import {Link} from 'react-router-dom';
import React, {useState} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';

export const SiteSidebar = observer(() => {
    const [subsDisabled, setSubsDisabled] = useState(false);
    const api = useAPI();
    const {site} = useAppState();

    if (!site) {
        return <></>;
    }

    const handleSubscribe = (subscribe: boolean) => {
        setSubsDisabled(true);
        api.site.subscribe(site.site, subscribe, false)
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
            <Link className={styles.siteName} to={'/'}> {site.name}</Link>
            {site.site !== 'main' &&
            <div className={styles.subscribe}>
                {site.subscribe?.main ?
                    <button className={styles.subscribed} disabled={subsDisabled} onClick={() => handleSubscribe(false)}>Отписаться</button>
                    :
                    <button className={styles.notSubscribed} disabled={subsDisabled} onClick={() => handleSubscribe(true)}>Подписаться</button>
                }
            </div>}
            <div className={styles.podsites}>
                {site.site !== 'main' && <div><a href="https://orbitar.space/">Главная</a></div>}
                {site.site !== 'idiod' && <div><a href="https://idiod.orbitar.space/">idiod</a></div>}
                {site.site !== 'dev' && <div><a href="https://dev.orbitar.space/">Баги и фичи</a></div>}
            </div>
        </div>
    </div>);
});
