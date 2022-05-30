import React, {useEffect, useMemo} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {AllPostsFeedState, SitePostsFeedState, SubscriptionsPostsFeedState} from '../AppState/PostFeedState';
import PostFeedComponent from '../Components/PostFeedComponent';

export default function FeedPage() {
    const { site, siteInfo } = useAppState();
    const api = useAPI();
    const [search] = useSearchParams();

    const matchRoutePosts = !!useMatch('/posts');
    const matchRouteAll = !!useMatch('/all');

    let feedType: 'all' | 'subscriptions' | 'site' = 'site';
    let baseRoute = '/';
    if (site === 'main') {
        if (matchRoutePosts) {
            feedType = 'site';
            baseRoute = '/posts';
        }
        else if (matchRouteAll) {
            feedType = 'all';
            baseRoute = '/all';
        }
        else {
            feedType = 'subscriptions';
            baseRoute = '/';
        }
    } else {
        baseRoute = '/s/' + site;
    }

    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const state = useMemo(() => {
        switch (feedType) {
            case 'site':
                return new SitePostsFeedState(api, site, perpage);
            case 'all':
                return new AllPostsFeedState(api, perpage);
            case 'subscriptions':
                return new SubscriptionsPostsFeedState(api, perpage);
            default:
                throw new Error('Unknown feed type: ' + feedType);
        }
    }, [api, site, feedType, perpage]);


    useEffect(() => {
        state.loadPage(page).catch();
    }, [page, state]);

    useEffect(() => {
        window.scrollTo({top: 0});
    }, [page]);

    useEffect(() => {
        let docTitle = siteInfo?.name || 'ЪУЪ';
        if (feedType === 'subscriptions') {
            docTitle += ' / Подписки';
        }
        else if (feedType === 'all') {
            docTitle += ' / Все посты';
        }
        document.title = docTitle;
    }, [siteInfo, feedType]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {siteInfo?.site === 'main' && <div className={styles.feedControls}>
                    <Link to='/' className={feedType === 'subscriptions' ? styles.active : ''} replace={true}>мои подписки</Link> •
                    <Link to='/all' className={feedType === 'all' ? styles.active : ''} replace={true}>все</Link> •
                    <Link to='/posts' className={feedType === 'site' ? styles.active : ''} replace={true}>только главная</Link>
                </div>}
                <PostFeedComponent state={state} baseRoute={baseRoute}/>
            </div>
        </div>
    );
}


