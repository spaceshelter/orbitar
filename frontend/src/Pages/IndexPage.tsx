import React, {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import {PostInfo} from '../Types/PostInfo';
import styles from './IndexPage.module.css';
import PostComponent from '../Components/PostComponent';
import {SiteInfo} from '../Types/SiteInfo';
import SiteSidebar from './SiteSidebar';
import Paginator from '../Components/Paginator';
import {useSearch} from 'react-location';

export default function IndexPage() {
    const api = useAPI();
    const search = useSearch<{Search: {page: number}}>();
    const [feedLoading, setFeedLoading] = useState(true);
    const [posts, setPosts] = useState<PostInfo[]>();
    const [site, setSite] = useState<SiteInfo>();
    const [pageState, setPageState] = useState({page: search.page || 1, pages: 0});
    const perPage = 20;

    useEffect(() => {
        if (search.page !== pageState.page) {
            setPageState({ ...pageState, page: search.page || 1 });
        }
    }, [search.page]);

    useEffect(() => {
        setFeedLoading(true);

        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        const siteInfo = api.cache.getSite(site);
        if (siteInfo) {
            setSite(siteInfo);
        }

        console.log('REQUEST PAGE', pageState.page);

        api.post.feed(site, pageState.page, perPage)
            .then(result => {
                setFeedLoading(false);
                setPosts(result.posts);
                setSite(result.site);
                const pages = Math.floor((result.total - 1) / perPage) + 1;
                setPageState({page: pageState.page, pages: pages});
                window.scrollTo(0, 0);
            })
            .catch(error => {
                console.log('FEED ERROR', error);
            });
    }, [api, pageState.page]);

    return (
        <div className={styles.container}>
            {site && <SiteSidebar site={site} />}

            <div className={styles.feed}>
                {feedLoading && <div className={styles.loading}>Загрузка</div>}
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} />)}
                </div>}

                <Paginator page={pageState.page} pages={pageState.pages} base={'/'} />
            </div>
        </div>
    );
}


