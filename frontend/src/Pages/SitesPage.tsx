import {useAPI} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import {toast} from 'react-toastify';
import {SiteWithUserInfo} from '../Types/SiteInfo';
import styles from './SitesPage.module.scss';
import {Link} from 'react-router-dom';
import {pluralize} from '../Utils/utils';

export const SitesPage = () => {
    const api = useAPI();
    const [sites, setSites] = useState<SiteWithUserInfo[]>([]);
    const [subsDisabled, setSubsDisabled] = useState(false);

    useEffect(() => {
        api.site.list(1, 1000)
            .then(setSites)
            .catch(err => {
                console.error('Site list error', err);
                toast.error('Не удалось загрузить список сайтов, увы.');
            });
    }, [api]);

    const handleSubscribe = async (site: string, value: boolean) => {
        setSubsDisabled(true);
        try {
            await api.site.subscribe(site, value, false);

            const siteInfo = sites.find(s => s.site === site);
            if (siteInfo) {
                siteInfo.subscribe = { main: value, bookmarks: false };
                setSites(sites);
            }
        }
        finally {
            setSubsDisabled(false);
        }
    };

    return <div className={styles.sites}>
        {sites.map(site => <div key={site.site} className='site'>
            <div className='site-info'>
                <Link className='title' to={`/s/${site.site}`}>{site.name}</Link>
                <div className='subscribers'><Link to={`/s/${site.site}`}>/s/{site.site}</Link> • {pluralize(site.subscribers, ['подписчик', 'подписчика', 'подписчиков'])}</div>
            </div>
            <div className='subscribe'>
            {site.subscribe?.main ?
                <button className='subscribed' disabled={subsDisabled} onClick={() => handleSubscribe(site.site, false)}>Отписаться</button>
                :
                <button className='not-subscribed' disabled={subsDisabled} onClick={() => handleSubscribe(site.site, true)}>Подписаться</button>
            }
            </div>
        </div>)}
        <div><Link to='/sites/create'>Создать новый</Link></div>
    </div>;
};
