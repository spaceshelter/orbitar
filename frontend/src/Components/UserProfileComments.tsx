import React, {useEffect, useRef, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import styles from '../Pages/FeedPage.module.scss';
import Paginator from '../Components/Paginator';
import {useLocation, useSearchParams} from 'react-router-dom';
import {useCache} from '../API/use/useCache';
import {CommentInfo} from '../Types/PostInfo';
import CommentComponent from './CommentComponent';
import {useDebouncedCallback} from 'use-debounce';

type UserProfileCommentsProps = {
  username: string;
};

export default function UserProfileComments(props: UserProfileCommentsProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const perpage = 20;
    const page = parseInt(searchParams.get('page') || '1');
    const defaultFilter = searchParams.get('filter') as string;

    const api = useAPI();
    const [cachedComments, setCachedComments] = useCache<CommentInfo[]>('user-profile-comments', [props.username, page, perpage]);
    const [cachedParentComments, setCachedParentComments] = useCache<Record<number, CommentInfo> | undefined>('user-profile-parent-comments', [props.username, page, perpage]);
    const [comments, setComments] = useState<CommentInfo[] | undefined>(cachedComments);
    const [parentComments, setParentComments] = useState<Record<number, CommentInfo> | undefined>(cachedParentComments);
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState(0);
    const [error, setError] = useState<string>();
    const [reloadIdx, setReloadIdx] = useState(0);
    const [filter, setFilter] = useState(defaultFilter || null);
    const {search} = useLocation();
    const filterInputRef = useRef<HTMLInputElement>(null);

    const setDebouncedFilter = useDebouncedCallback((value: string) => {
        setFilter(value);
        setSearchParams({filter: value});
    }, 1000);

    const reload = () => {
        setReloadIdx(reloadIdx + 1);
    };

    const handleFilterChange = (e: React.FormEvent<HTMLInputElement>) => {
        if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.key === 'Enter') {
            const value = e.currentTarget.value;
            setFilter(value);
            setSearchParams({filter: value});
        } else {
            setDebouncedFilter(e.currentTarget.value);
        }
    };

    const getParentComment = (commentId: number): CommentInfo | undefined => {
        if (parentComments && parentComments[commentId]) {
            return parentComments[commentId];
        }
        return undefined;
    };

    useEffect(() => {
        const newSearchParams = new URLSearchParams(search);
        const newFilterValue = newSearchParams.get('filter') as string;
        setFilter(newFilterValue);
        if (filterInputRef.current) {
            filterInputRef.current.value = newFilterValue;
        }
    }, [search]);

    useEffect(() => {
        api.userAPI.userComments(props.username, filter || '', page, perpage).then(result => {
            setCachedComments(result.comments);
            setCachedParentComments(result.parentComments);
            setError(undefined);
            setLoading(false);
            setComments(result.comments);
            setParentComments(result.parentComments);
            const pages = Math.floor((result.total - 1) / perpage) + 1;
            setPages(pages);
        }).catch(error => {
            console.log('USER PROFILE COMMENTS ERROR', error);
            setError('Не удалось загрузить ленту комментариев пользователя');
        });
    }, [page, reloadIdx, filter]);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [page]);

    const params = filter ? {filter} : undefined;

    return (
        <div className={styles.container}>
            <div className={styles.filter}>
                <input ref={filterInputRef} onKeyUp={handleFilterChange} onChange={handleFilterChange} placeholder={'фильтровать'} type="search" defaultValue={defaultFilter} />
            </div>
            <div className={styles.feed}>
                {loading ? <div className={styles.loading}></div> :
                 <>
                    {error && <div className={styles.error}>{styles.error}</div> }
                     {comments ?
                         comments.map(comment => <CommentComponent idx={getParentComment(comment.parentComment) ? 1 : 0} parent={getParentComment(comment.parentComment)} key={comment.id} comment={comment} showSite={comment.site !== 'main'} />)
                         :
                         (
                             error ? <div className={styles.error}>{error}<div><button onClick={reload}>Повторить</button></div></div>
                                 : <div className={styles.loading}>Загрузка...</div>
                         )
                     }
                    <div className={styles.paginatorContainer}>
                        <Paginator page={page} pages={pages} base={`/u/${props.username}/comments`} queryStringParams={params} />
                    </div>
                </>}
            </div>
        </div>
    );
}
