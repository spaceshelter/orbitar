import React, {useEffect, useState} from 'react';
import styles from '../Pages/FeedPage.module.scss';
import feedStyles from '../Pages/FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {useSearchParams} from 'react-router-dom';
import {useFeed} from '../API/use/useFeed';
import {SubmitHandler, useForm} from 'react-hook-form';

type UserProfilePostsProps = {
  username: string;
};

type FilterForm = {
  filter: string;
};

export default function UserProfilePosts(props: UserProfilePostsProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const perpage = 20;
    const page = parseInt(searchParams.get('page') || '1');
    const defaultFilter = searchParams.get('filter') as string;
    const [filter, setFilter] = useState(defaultFilter || '');

    const {register, handleSubmit} = useForm<FilterForm>({
        mode: 'onSubmit'
    });

    const { posts, loading, pages, error, updatePost } = useFeed(props.username, 'user-profile', page, perpage, undefined, undefined, filter);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    const doFilter = (filter: string) => {
      setSearchParams({filter});
      setFilter(filter);
    };

    const onSubmit: SubmitHandler<FilterForm> = async data => {
      doFilter(data.filter);
    };

    return (
        <div className={styles.container}>
          <div className={feedStyles.filter}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="text" {...register('filter', {
                required: ''
              })} defaultValue={defaultFilter}/>
              <input type="submit" disabled={loading} value="фильтровать"/>
            </form>
          </div>
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
