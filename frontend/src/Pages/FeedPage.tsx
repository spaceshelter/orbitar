import React, {useEffect, useState} from 'react';
import {useAPI, useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {FeedType, useFeed} from '../API/use/useFeed';
import {APIError} from '../API/APIBase';
import {FeedSorting} from '../Types/FeedSortingSettings';
import classNames from 'classnames';
import {observer} from 'mobx-react-lite';
import {LARGE_AUTO_CUT, SMALL_AUTO_CUT} from '../Components/ContentComponent';

const FeedPage = observer(() => {
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

    const [sorting, setSorting] = useState<FeedSorting>();
    const {posts, loading, pages, error, updatePost, setLoading} = useFeed(site, feedType, page, perpage, setSorting, sorting);

    useEffect(() => {
        const element = document.querySelector('#app');
        element && element.scrollIntoView({block: 'start'});
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

    const handleFeedSortingChange = (newFeedSorting: FeedSorting) => async (e: React.MouseEvent) => {
        e.preventDefault();
        setLoading(true);
        await api.feed.saveSorting(site, newFeedSorting);
        setSorting(newFeedSorting);
        setLoading(false);
    };

    const liveSorting = sorting !== FeedSorting.postCreatedAt;

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                <div className={styles.feedControlsWrapper}>
                    {siteInfo && <div className={styles.feedControls}>
                      <a href='#' className={classNames({[styles.active]: liveSorting})} onClick={handleFeedSortingChange(FeedSorting.postCommentedAt)}><i className='i i-live'></i>LIVE</a>
                      <a href='#' className={classNames({[styles.active]: !liveSorting})} onClick={handleFeedSortingChange(FeedSorting.postCreatedAt)}><i className='i i-new'></i>НОВОЕ</a>
                    </div>}
                    {siteInfo?.site === 'main' && <div className={styles.feedControls}>
                        <Link to='/' className={feedType === 'subscriptions' ? styles.active : ''} replace={true}>подписки</Link>•<Link to='/all' className={feedType === 'all' ? styles.active : ''} replace={true}>всё</Link>•<Link to='/posts' className={feedType === 'site' ? styles.active : ''} replace={true}>главная</Link>
                    </div>}
                </div>
                {!error && loading && <div className={styles.loading}></div>}
                {error && <div className={styles.error}>{
                    (error[1] as APIError)?.code === 'no-site' ? <>Нет такого сайта. <Link to='/sites/create'>Создать</Link>?</> : error[0]
                }</div> }
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={siteInfo?.site !== post.site} onChange={updatePost}
                                                      autoCut={post.vote === -1 ? SMALL_AUTO_CUT : LARGE_AUTO_CUT} />)}
                </div>}

                <div className={styles.paginatorContainer}>
                    <Paginator page={page} pages={pages} base={baseRoute} />
                </div>
            </div>
        </div>
    );
});

export default FeedPage;

