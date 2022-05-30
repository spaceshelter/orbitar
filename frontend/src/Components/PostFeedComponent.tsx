import {Observer, observer} from 'mobx-react-lite';
import {PostsFeedStateBase} from '../AppState/PostFeedState';
import {PostInfo} from '../Types/PostInfo';
import PostComponent from './PostComponent';
import React from 'react';
import styles from '../Pages/FeedPage.module.scss';
import classNames from 'classnames';
import Paginator from './Paginator';
import {useAppState} from '../AppState/AppState';

const PostsList = observer((props: { posts: PostInfo[], state: PostsFeedStateBase }) => {
    const {posts, state} = props;
    const {site} = useAppState();
    return <>{posts.map((post, i) => <PostComponent key={post.id} post={post} showSite={site !== post.site}
                                                    autoCut={true} onChange={state.updatePost}/>)}</>;
});

const PostFeedComponent = (props: { state: PostsFeedStateBase, baseRoute: string }) => {
    const state = props.state;
    const posts = state.posts;

    return <>
        <Observer>{() => <>
            {state.loading && !state.posts.length && <div className={styles.loading}>Загрузка</div>}
            {state.error && <div className={styles.error}>{styles.error}</div>}
        </>}</Observer>

        <Observer>{() => <div
            className={classNames(styles.posts, {[styles.blur]: state.loading && state.posts.length})}>
            <Observer>{() => <>{!state.loading && state.posts.length === 0 &&
                <div>Здесь ничего нет. Вероятно, вы уже всё прочитали!</div>}</>}</Observer>
            <PostsList posts={posts} state={state} />
        </div>}</Observer>

        <Observer>{() => <Paginator page={state.page} pages={state.pages} base={props.baseRoute}/>}</Observer>
    </>;
};

export default PostFeedComponent;