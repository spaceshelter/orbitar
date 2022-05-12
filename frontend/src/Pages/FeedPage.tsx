import React, {useEffect} from 'react';
import {useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {FeedType, useFeed} from '../API/use/useFeed';

export default function FeedPage() {
    let siteName = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        siteName = window.location.hostname.split('.')[0];
    }

    const { site } = useAppState();
    const [search] = useSearchParams();

    const matchRoutePosts = !!useMatch('/posts');
    const matchRouteSubscriptions = !!useMatch('/subscriptions');

    let feedType: FeedType = 'site';
    let baseRoute = '/';
    if (siteName === 'main') {
        if (matchRoutePosts) {
            feedType = 'site';
            baseRoute = '/posts';
        }
        else if (matchRouteSubscriptions) {
            feedType = 'subscriptions';
            baseRoute = '/subscriptions';
        }
        else {
            feedType = 'all';
            baseRoute = '/';
        }
    }

    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const { posts, loading, pages, error, updatePost } = useFeed(siteName, feedType, page, perpage);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    useEffect(() => {
        let docTitle = site?.name || 'ЪУЪ';
        if (feedType === 'subscriptions') {
            docTitle += ' / Подписки';
        }
        else if (feedType === 'all') {
            docTitle += ' / Все посты';
        }
        document.title = docTitle;
    }, [site, feedType]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {site?.site === 'main' && <div className={styles.feedControls}>
                    <Link to='/' className={feedType === 'all' ? styles.active : ''} replace={true}>все</Link> • <Link to='/subscriptions' className={feedType === 'subscriptions' ? styles.active : ''} replace={true}>мои подписки</Link> • <Link to='/posts' className={feedType === 'site' ? styles.active : ''} replace={true}>только главная</Link>
                </div>}
                {loading && <div className={styles.loading}>Загрузка</div>}
                {error && <div className={styles.error}>{styles.error}</div> }
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={site?.site !== post.site} onChange={updatePost} />)}
                </div>}

                <Paginator page={page} pages={pages} base={baseRoute} />
            </div>
        </div>
    );
}


