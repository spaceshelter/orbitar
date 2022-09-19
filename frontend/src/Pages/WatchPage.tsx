import React, {useEffect, useMemo} from 'react';
import styles from './FeedPage.module.scss';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {useAPI, useAppState} from '../AppState/AppState';
import {WatchPostsFeedState} from '../AppState/PostFeedState';
import PostFeedComponent from '../Components/PostFeedComponent';

export default function WatchPage() {
    const [search] = useSearchParams();
    const matchRouteAll = useMatch('/watch/all');

    const isAll = !!matchRouteAll;
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const {site} = useAppState();

    const api = useAPI();
    const state = useMemo(() => new WatchPostsFeedState(api, isAll, perpage), [api, site, isAll, perpage]);
    useEffect(() => {
        state.loadPage(page).catch();
    }, [page, state]);

    useEffect(() => {
        window.scrollTo({top: 0});
    }, [page]);

    useEffect(() => {
        document.title = 'Новые комментарии';
    });

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                <div className={styles.feedControls}>
                    <Link to="/watch" className={isAll ? '' : styles.active} replace={true}>непрочитанные</Link> • <Link
                    to="/watch/all" className={isAll ? styles.active : ''} replace={true}>все</Link>
                </div>
                <PostFeedComponent state={state} baseRoute={isAll ? '/watch/all' : '/watch'}/>
            </div>
        </div>
    );
}