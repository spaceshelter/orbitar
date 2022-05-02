import { SiteWithUserInfo} from '../Types/SiteInfo';
import styles from './SiteSidebar.module.css';
import {Link} from 'react-location';
import React, {useState} from 'react';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';

interface SiteSidebarProps {
    site: SiteWithUserInfo;
}

export default function SiteSidebar(props: SiteSidebarProps) {
    const [subsDisabled, setSubsDisabled] = useState(false);
    const api = useAPI();

    const handleSubscribe = (subscribe: boolean) => {
        setSubsDisabled(true);
        api.site.subscribe(props.site.site, subscribe, false)
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
            <Link className={styles.siteName} to={'/'}> {props.site.name}</Link>
            <Link className={styles.newPost} to={'/create'}>Новый пост</Link>
            {props.site.site !== 'main' &&
            <div className={styles.subscribe}>
                {props.site.subscribe?.main ?
                    <button className={styles.subscribed} disabled={subsDisabled} onClick={() => handleSubscribe(false)}>Отписаться</button>
                    :
                    <button className={styles.notSubscribed} disabled={subsDisabled} onClick={() => handleSubscribe(true)}>Подписаться</button>
                }
            </div>}
            <div className={styles.podsites}>
                {props.site.site !== 'main' && <div><a href="https://orbitar.space/">Главная</a></div>}
                {props.site.site !== 'idiod' && <div><a href="https://idiod.orbitar.space/">idiod</a></div>}
                {props.site.site !== 'dev' && <div><a href="https://dev.orbitar.space/">Баги и фичи</a></div>}
            </div>
        </div>
    </div>)
}
