import React, {useEffect} from 'react';
import styles from '../Pages/FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {useSearchParams} from 'react-router-dom';
import {useFeed} from '../API/use/useFeed';

type UserProfilePostsProps = {
  username: string;
};

export default function UserProfilePosts(props: UserProfilePostsProps) {
    const [search] = useSearchParams();
    const perpage = 20;
    const page = parseInt(search.get('page') || '1');

    const { posts, loading, pages, error, updatePost } = useFeed(props.username, 'user-profile', page, perpage);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {loading ? <div className={styles.loading}></div> :
                 <>
                    {error && <div className={styles.error}>{styles.error}</div> }
                    {posts && <div className={styles.posts}>
                        {posts.map(post => <PostComponent key={post.id} post={post} showSite={true} onChange={updatePost} autoCut={true} />)}
                    </div>}
                    <Paginator page={page} pages={pages} base={`/u/${props.username}/posts`} />
                </>}
            </div>
        </div>
    );
}
