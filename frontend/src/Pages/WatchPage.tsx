import React, {useEffect} from 'react';
import {useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {useFeed} from '../API/use/useFeed';

export default function WatchPage() {
    let siteName = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        siteName = window.location.hostname.split('.')[0];
    }

    const { site } = useAppState();
    const [search] = useSearchParams();
    const matchRouteAll = useMatch('/watch/all');
    // temporary replacement
    if (siteName === 'design-test') {
        siteName = 'main';
    }
    const isAll = !!matchRouteAll;
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const { posts, loading, pages, error, updatePost } = useFeed(siteName, isAll ? 'watch-all' : 'watch', page, perpage, 0);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    document.title = 'Новые комментарии';

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                <div className={styles.feedControls}>
                    <Link to='/watch' className={isAll ? '' : styles.active} replace={true}>непрочитанные</Link> • <Link to='/watch/all' className={isAll ? styles.active : ''} replace={true}>все</Link>
                </div>
                {loading && <div className={styles.loading}>Загрузка</div>}
                {error && <div className={styles.error}>{styles.error}</div> }
                {posts && <div className={styles.posts}>
                    {posts.length === 0 && <div>Здесь ничего нет. Вероятно, вы уже всё прочитали!</div>}
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={site?.site !== post.site} onChange={updatePost} autoCut={true} />)}
                </div>}

                <Paginator page={page} pages={pages} base={isAll ? '/watch/all' : '/watch'} />
            </div>
        </div>
    );
}


