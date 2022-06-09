import styles from './SiteSidebar.module.scss';
import {Link} from 'react-router-dom';
import React, {useState} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';

export const SiteSidebar = observer(() => {
    const [subsDisabled, setSubsDisabled] = useState(false);
    const api = useAPI();
    const {site, siteInfo, subscriptions} = useAppState();

    const handleSubscribe = (subscribe: boolean) => {
        if (!siteInfo) {
            return;
        }
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
        <div className='fixed'>
            <Link className='site-name' to={site !== 'main' ? `/s/${site}` : '/'}> {siteInfo?.name || '...'}</Link>
            {site !== 'main' &&
            <div className='subscribe'>
                {!siteInfo || siteInfo.subscribe?.main ?
                    <button className='subscribed' disabled={!siteInfo || subsDisabled} onClick={() => handleSubscribe(false)}>Отписаться</button>
                    :
                    <button className='not-subscribed' disabled={!siteInfo || subsDisabled} onClick={() => handleSubscribe(true)}>Подписаться</button>
                }
            </div>}
            {siteInfo?.siteInfo && <div className='site-info'>{siteInfo.siteInfo}</div>}
            <div className='subsites'>
                { subscriptions.map(site => {
                    return <div key={site.site}><Link to={site.site === 'main' ? '/' : `/s/${site.site}`}>{site.name}</Link></div>;
                }) }
            </div>
            <Link className='all-subsites' to='/sites'>Все подсайты</Link>
        </div>
    </div>);
});
