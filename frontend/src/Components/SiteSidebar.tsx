import styles from './SiteSidebar.module.scss';
import {Link} from 'react-router-dom';
import React, {useEffect, useState} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {observer} from 'mobx-react-lite';
import {TopbarMenuState} from './Topbar';
import classNames from 'classnames';

type SidebarProps = {
    onMenuToggle: () => void;
    menuState: TopbarMenuState;
};

export const SiteSidebar = observer((props: SidebarProps) => {
    const [subsDisabled, setSubsDisabled] = useState(false);
    const api = useAPI();
    const {site, siteInfo, subscriptions} = useAppState();

    const menuToggle = () => {
        if(window.innerWidth <= 1179 ) props.onMenuToggle();
    };

    const handleSubscribe = (subscribe: boolean) => {
        if (!siteInfo) {
            return;
        }
        setSubsDisabled(false);
        api.site.subscribe(siteInfo.site, subscribe, false)
            .then(() => {
                setSubsDisabled(false);
            })
            .catch(() => {
                setSubsDisabled(false);
                toast.error('Настройки подписки не изменены!');
            });
    };

    useEffect(() => {
        if (!siteInfo) {
            api.site.updateSiteInfo().then().catch(
                () => toast.error('Не удалось обновить информацию о сайте!'),
            );
        }
    }, [siteInfo, api.site]);

    useEffect(() => {
        if (subscriptions === undefined) {
            api.site.subscriptons().then().catch(
                () => toast.error('Не удалось получить список подписок!'),
            );
        }
    });

    return (
        <div className={classNames(styles.sidebar, {
            [styles.open]: props.menuState === 'close',
        })}>
            <div className={styles.fade} onClick={menuToggle}></div>
            <div className={styles.container}>
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
                        { subscriptions && subscriptions.map(site => {
                            return <div key={site.site}><Link onClick={menuToggle} to={site.site === 'main' ? '/' : `/s/${site.site}`}>{site.name}</Link></div>;
                        }) }
                    </div>
                    <Link onClick={menuToggle} className='all-subsites' to='/sites'>Все подсайты</Link>
                </div>
            </div>
        </div>
    );
});
