import React, {useEffect, useState} from 'react';
import {useAppState} from '../AppState/AppState';
import {PostInfo} from '../Types/PostInfo';
import styles from './FeedPage.module.css';
import PostComponent from '../Components/PostComponent';
import SiteSidebar from '../Components/SiteSidebar';
import Paginator from '../Components/Paginator';
import {Link, useMatchRoute, useSearch} from 'react-location';

export default function FeedPage() {
    let siteName = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        siteName = window.location.hostname.split('.')[0];
    }

    const { site, api } = useAppState();
    const search = useSearch<{Search: {page: number}}>();
    const [feedLoading, setFeedLoading] = useState(true);
    const [posts, setPosts] = useState<PostInfo[]>();
    const matchRoute = useMatchRoute();
    const isPosts = matchRoute({ to: '/posts' });
    const [pageState, setPageState] = useState({ siteName: siteName, isPosts: !!isPosts, page: search.page || 1, pages: 0});
    const perPage = 20;

    // console.log('isPosts', isPosts);

    useEffect(() => {
        if (search.page !== pageState.page) {
            setPageState({ ...pageState, page: search.page || 1 });
        }
    }, [search.page]);

    useEffect(() => {
        setPageState((pageState) => ({ ...pageState, isPosts: !!isPosts }));
    }, [isPosts]);

    useEffect(() => {
        setFeedLoading(true);

        console.log(`Request feed ${site ? site : '[subscriptions]'}, page: ${pageState.page}`);

        if (siteName !== 'main' || pageState.isPosts) {
            api.post.feedPosts(siteName, pageState.page, perPage)
                .then(result => {
                    setFeedLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perPage) + 1;
                    setPageState({ siteName, isPosts: !!isPosts, page: pageState.page, pages: pages});
                    window.scrollTo(0, 0);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                });
        }
        else {
            api.post.feedSubscriptions(pageState.page, perPage)
                .then(result => {
                    setFeedLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perPage) + 1;
                    setPageState({siteName, isPosts: !!isPosts, page: pageState.page, pages: pages});
                    window.scrollTo(0, 0);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                });
        }
    }, [api, pageState.page, pageState.isPosts]);

    return (
        <div className={styles.container}>
            {site && <SiteSidebar site={site} />}

            <div className={styles.feed}>
                {site?.site === 'main' && <div className={styles.feedControls}>
                    <Link to='/' className={isPosts ? '' : styles.active}>мои подписки</Link> <Link to='/posts' className={isPosts ? styles.active : ''}>только главная</Link>
                </div>}
                {feedLoading && <div className={styles.loading}>Загрузка</div>}
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={site?.site !== post.site} />)}
                </div>}

                <Paginator page={pageState.page} pages={pageState.pages} base={isPosts ? '/posts' : '/'} />
            </div>
        </div>
    );
}


