import React, {useEffect} from 'react';
import {useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.css';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {useFeed} from '../API/use/useFeed';

export default function FeedPage() {
    let siteName = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        siteName = window.location.hostname.split('.')[0];
    }

    const { site } = useAppState();
    const [search] = useSearchParams();
    const matchRoutePosts = useMatch('/posts');
    // temporary replacement
    if (siteName === 'design-test') {
        siteName = 'main';
    }
    const isPosts = siteName !== 'main' || !!matchRoutePosts;
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const { posts, loading, pages, error, updatePost } = useFeed(siteName, isPosts ? 'site' : 'subscriptions', page, perpage);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    useEffect(() => {
        let docTitle = site?.name || 'ЪУЪ';
        if (!isPosts) {
            docTitle += ' / Подписки';
        }
        document.title = docTitle;
    }, [site, isPosts]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {site?.site === 'main' && <div className={styles.feedControls}>
                    <Link to='/' className={isPosts ? '' : styles.active} replace={true}>мои подписки</Link> • <Link to='/posts' className={isPosts ? styles.active : ''} replace={true}>только главная</Link>
                </div>}
                {loading && <div className={styles.loading}>Загрузка</div>}
                {error && <div className={styles.error}>{styles.error}</div> }
                {posts && <div className={styles.posts}>
                    {posts.map(post => <PostComponent key={post.id} post={post} showSite={site?.site !== post.site} onChange={updatePost} />)}
                </div>}

                <Paginator page={page} pages={pages} base={isPosts ? '/posts' : '/'} />
            </div>
        </div>
    );
}


