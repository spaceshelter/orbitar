import {useAPI} from '../../AppState/AppState';
import {useEffect, useMemo, useState} from 'react';
import {PostInfo} from '../../Types/PostInfo';
import {useCache} from './useCache';
import {FeedSorting} from '../../Types/FeedSortingSettings';

export type FeedType = 'all' | 'subscriptions' | 'site' | 'watch' | 'watch-all' | 'user-profile';

export function useFeed(id: string, feedType: FeedType | undefined, page: number, perpage: number, feedSorting: FeedSorting = FeedSorting.postCommentedAt) {
    const api = useAPI();
    const [cachedPosts, setCachedPosts] = useCache<PostInfo[]>('feed', [id, feedType, page, perpage]);

    const [posts, setPosts] = useState<PostInfo[] | undefined>(cachedPosts);
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState(0);
    const [error, setError] = useState<[string, Error]>();

    const updatePost = useMemo(() => {
        return (id: number, partial: Partial<PostInfo>) => {
            if (!posts) {
                return;
            }
            const postIndex = posts.findIndex(p => p.id === id);
            if (postIndex !== -1) {
                const newPost = {...posts[postIndex], ...partial};
                const newPosts = [...posts];
                newPosts[postIndex] = newPost;
                setPosts(newPosts);
            }
        };
    }, [posts]);

    useEffect(() => {
        setLoading(true);
        if (feedType === 'site') {
            api.post.feedPosts(id, page, perpage)
                .then(result => {
                    setCachedPosts(result.posts);

                    setError(undefined);
                    setLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perpage) + 1;
                    setPages(pages);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                    setError(['Не удалось загрузить ленту постов', error]);
                });
        }
        else if (feedType === 'subscriptions') {
            api.post.feedSubscriptions(page, perpage)
                .then(result => {
                    setCachedPosts(result.posts);

                    setError(undefined);
                    setLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perpage) + 1;
                    setPages(pages);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                    setError(['Не удалось загрузить ленту постов', error]);
                });
        }
        else if (feedType === 'all') {
            api.post.feedAll(page, perpage)
                .then(result => {
                    setCachedPosts(result.posts);

                    setError(undefined);
                    setLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perpage) + 1;
                    setPages(pages);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                    setError(['Не удалось загрузить ленту постов', error]);
                });
        }
        else if (feedType === 'watch' || feedType === 'watch-all') {
            api.post.feedWatch(feedType === 'watch-all', page, perpage)
                .then(result => {
                    setCachedPosts(result.posts);

                    setError(undefined);
                    setLoading(false);
                    setPosts(result.posts);
                    const pages = Math.floor((result.total - 1) / perpage) + 1;
                    setPages(pages);
                })
                .catch(error => {
                    console.log('FEED ERROR', error);
                    setError(['Не удалось загрузить ленту постов', error]);
                });
        }
        else if (feedType === 'user-profile') {
            api.userAPI.userPosts(id, page, perpage).then( result => {
                setCachedPosts(result.posts);

                setError(undefined);
                setLoading(false);
                setPosts(result.posts);
                const pages = Math.floor((result.total - 1) / perpage) + 1;
                setPages(pages);
            }).catch(error => {
                console.log('USER PROFILE POSTS ERROR', error);
                setError(['Не удалось загрузить ленту постов', error]);
            });
        }
    }, [id, feedType, page, api.post, perpage, feedSorting]);

    return { posts, loading, pages, error, updatePost };
}