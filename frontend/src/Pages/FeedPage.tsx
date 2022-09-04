import React, {useEffect, useState} from 'react';
import {useAppState, useAPI} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {FeedType, useFeed} from '../API/use/useFeed';
import {APIError} from '../API/APIBase';
import {FeedSorting} from '../Types/FeedSortingSettings';

export default function FeedPage() {
    const { site, siteInfo } = useAppState();
    const api = useAPI();

    const [search] = useSearchParams();

    const matchRoutePosts = !!useMatch('/posts');
    const matchRouteAll = !!useMatch('/all');

    let feedType: FeedType = 'site';
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

    const [changeSorting, setChangeSorting] = useState(-1);
    const {posts, loading, pages, error, updatePost, sorting} = useFeed(site, feedType, page, perpage, changeSorting);

    useEffect(() => {
        window.scrollTo({ top: 0 });
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

    const handleFeedSortingChange = async (e: React.MouseEvent) => {
        e.preventDefault();
        const feedSorting = (e.currentTarget as HTMLAnchorElement).dataset.feedSorting;
        if (feedSorting === undefined || !siteInfo?.site) {
            return;
        }
        const newFeedSorting = parseInt(feedSorting, 10) as FeedSorting;
        await api.feed.saveSorting(site, newFeedSorting);
        setChangeSorting(newFeedSorting);
    };
    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {siteInfo?.site === 'main' && <div className={styles.feedControls}>
                    <Link to='/' className={feedType === 'subscriptions' ? styles.active : ''} replace={true}>мои подписки</Link> • <Link to='/all' className={feedType === 'all' ? styles.active : ''} replace={true}>все</Link> • <Link to='/posts' className={feedType === 'site' ? styles.active : ''} replace={true}>только главная</Link>
                </div>}
                {siteInfo && <div className={styles.feedControls}>
                  <a href='#' data-feed-sorting={FeedSorting.postCommentedAt} className={sorting === FeedSorting.postCommentedAt ? styles.active : ''} onClick={handleFeedSortingChange}>LIVE</a>&nbsp;•&nbsp;
                  <a href='#' data-feed-sorting={FeedSorting.postCreatedAt} className={sorting === FeedSorting.postCreatedAt ? styles.active : ''} onClick={handleFeedSortingChange}>НОВОЕ</a>
                </div>}
                {!error && loading && <div className={styles.loading}>Загрузка</div>}
                {error && <div className={styles.error}>{
                    (error[1] as APIError)?.code === 'no-site' ? <>Нет такого сайта. <Link to='/sites/create'>Создать</Link>?</> : error[0]
                }</div> }
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={siteInfo?.site !== post.site} onChange={updatePost} autoCut={true} />)}
                </div>}

                <Paginator page={page} pages={pages} base={baseRoute} />
            </div>
        </div>
    );
}


