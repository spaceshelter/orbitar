import React, {useEffect, useMemo} from 'react';
import styles from './FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {Link, useMatch, useSearchParams} from 'react-router-dom';
import {observer, Observer} from 'mobx-react-lite';
import {useAPI, useAppState} from '../AppState/AppState';
import {WatchPostFeedState} from '../AppState/PostFeedState';
import {PostInfo} from '../Types/PostInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';
import classNames from 'classnames';

export default function WatchPage() {
    const [search] = useSearchParams();
    const matchRouteAll = useMatch('/watch/all');

    const isAll = !!matchRouteAll;
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const {site, siteInfo }  = useAppState();

    const api = useAPI();
    const state = useMemo(() => new WatchPostFeedState(api, site, isAll, perpage), [api, site, isAll, perpage]);
    useEffect(() => {
        state.loadPage(page);
    });

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    document.title = 'Новые комментарии';
    const posts = state.posts;

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                <div className={styles.feedControls}>
                    <Link to="/watch" className={isAll ? '' : styles.active} replace={true}>непрочитанные</Link> • <Link
                    to="/watch/all" className={isAll ? styles.active : ''} replace={true}>все</Link>
                </div>
                <Observer>{() => <>
                    {state.loading && !state.posts.length && <div className={styles.loading}>Загрузка</div>}
                    {state.error && <div className={styles.error}>{styles.error}</div> }
                </>}</Observer>

                <Observer>{() => <div className={classNames(styles.posts, { [styles.blur] : state.loading && state.posts.length })}>
                    <Observer>{() => <>{!state.loading && state.posts.length === 0 && <div>Здесь ничего нет. Вероятно, вы уже всё прочитали!</div>}</>}</Observer>
                    <PostsList posts={posts} state={state} site={siteInfo} />
                </div>}</Observer>

                <Observer>{() => <Paginator page={state.page} pages={state.pages} base={isAll ? '/watch/all' : '/watch'} />}</Observer>
            </div>
        </div>
    );
}

const PostsList = observer((props: { posts: PostInfo[], state: WatchPostFeedState, site: SiteWithUserInfo | undefined }) => {
    const {posts, state, site} = props;
    return <>{posts.map((post, i) => <PostComponent key={post.id} post={post} showSite={site?.site !== post.site}
                                                    onChange={state.updatePost}/>)}</>;
});