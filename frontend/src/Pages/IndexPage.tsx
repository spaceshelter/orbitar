import React, {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import {PostInfo} from '../Types/PostInfo';
import styles from './IndexPage.module.css';
import PostComponent from '../Components/PostComponent';
import {SiteInfo} from '../Types/SiteInfo';
import SiteSidebar from './SiteSidebar';

export default function IndexPage() {
    const api = useAPI();
    const [feedLoading, setFeedLoading] = useState(true);
    const [posts, setPosts] = useState<PostInfo[]>();
    const [site, setSite] = useState<SiteInfo>();

    useEffect(() => {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        let siteInfo = api.cache.getSite(site);
        if (siteInfo) {
            setSite(siteInfo);
        }

        api.post.feed(site, 1)
            .then(result => {
                setFeedLoading(false);
                setPosts(result.posts);
                setSite(result.site);
            })
            .catch(error => {
                console.log('FEED ERROR', error);
            });
    }, [api]);

    return (
        <div className={styles.container}>
            {site && <SiteSidebar site={site} />}

            <div className={styles.feed}>
                {feedLoading && <div className={styles.loading}>Загрузка</div>}
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} />)}
                </div>}
            </div>
        </div>
    );
}