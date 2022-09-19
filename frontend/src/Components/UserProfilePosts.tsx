import React, {useEffect, useMemo} from 'react';
import styles from '../Pages/FeedPage.module.scss';
import {useSearchParams} from 'react-router-dom';
import PostFeedComponent from './PostFeedComponent';
import {UserPostsFeedState} from '../AppState/PostFeedState';
import {useAPI} from '../AppState/AppState';

type UserProfilePostsProps = {
  username: string;
};

export default function UserProfilePosts(props: UserProfilePostsProps) {
    const [search] = useSearchParams();
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');
    const api = useAPI();
    const state = useMemo(() => new UserPostsFeedState(api, props.username, perpage), [api, props.username, perpage]);

    useEffect(() => {
        state.loadPage(page).catch();
    }, [state, page]);
    useEffect(() => {
        window.scrollTo({top: 0});
    }, [page]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                <PostFeedComponent state={state} baseRoute={`/u/${props.username}/posts`} />
            </div>
        </div>
    );
}
