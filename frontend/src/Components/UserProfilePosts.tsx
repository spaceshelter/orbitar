import React, {useEffect, useRef, useState} from 'react';
import styles from '../Pages/FeedPage.module.scss';
import feedStyles from '../Pages/FeedPage.module.scss';
import PostComponent from '../Components/PostComponent';
import Paginator from '../Components/Paginator';
import {useLocation, useSearchParams} from 'react-router-dom';
import {useFeed} from '../API/use/useFeed';
import {useDebouncedCallback} from 'use-debounce';
import {LARGE_AUTO_CUT} from './ContentComponent';

type UserProfilePostsProps = {
  username: string;
};

export default function UserProfilePosts(props: UserProfilePostsProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const perpage = 20;
    const page = parseInt(searchParams.get('page') || '1');
    const defaultFilter = searchParams.get('filter') as string;
    const [filter, setFilter] = useState(defaultFilter || null);
    const {search} = useLocation();
    const filterInputRef = useRef<HTMLInputElement>(null);

    const setDebouncedFilter = useDebouncedCallback((value: string) => {
        setFilter(value);
        setSearchParams({filter: value});
    }, 1000);

    const handleFilterChange = (e: React.FormEvent<HTMLInputElement>) => {
        if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.key === 'Enter') {
            const value = e.currentTarget.value;
            setFilter(value);
            setSearchParams({filter: value});
        } else {
            setDebouncedFilter(e.currentTarget.value);
        }
    };

    useEffect(() => {
      const newSearchParams = new URLSearchParams(search);
      const newFilterValue = newSearchParams.get('filter') as string;
      setFilter(newFilterValue);
      if (filterInputRef.current) {
        filterInputRef.current.value = newFilterValue;
      }
    }, [search]);

  const { posts, loading, pages, error, updatePost } = useFeed(props.username, 'user-profile', page, perpage, undefined, undefined, filter || '');
    useEffect(() => {
        const element = document.querySelector('#app');
        element && element.scrollIntoView({block: 'start'});
    }, [page]);

    const params = filter ? {filter} : undefined;
    return (
        <div className={styles.container}>
          <div className={feedStyles.filter}>
            <input ref={filterInputRef} onKeyUp={handleFilterChange} onChange={handleFilterChange} placeholder={'фильтровать'} type="search" defaultValue={defaultFilter} />
          </div>
            <div className={styles.feed}>
                {loading ? <div className={styles.loading}></div> :
                 <>
                    {error && <div className={styles.error}>{styles.error}</div> }
                    {posts && <div className={styles.posts}>
                        {posts.map(post => <PostComponent key={post.id} post={post} showSite={true} onChange={updatePost}
                                                          autoCut={LARGE_AUTO_CUT} />)}
                    </div>}
                    <div className={styles.paginatorContainer}>
                      <Paginator page={page} pages={pages} base={`/u/${props.username}/posts`} queryStringParams={params} />
                    </div>
                </>}
            </div>
        </div>
    );
}
