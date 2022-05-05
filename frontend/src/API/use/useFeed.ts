import {useAPI} from '../../AppState/AppState';
import {useEffect, useMemo, useState} from 'react';
import {PostInfo} from '../../Types/PostInfo';
import {useCache} from './useCache';

export type FeedType = 'subscriptions' | 'site' | 'watch' | 'watch-all';

export function useFeed(site: string, feedType: FeedType, page: number, perpage: number) {
    const api = useAPI();
    const [cachedPosts, setCachedPosts] = useCache<PostInfo[]>('feed', [site, feedType, page, perpage]);

    const [posts, setPosts] = useState<PostInfo[] | undefined>(cachedPosts);
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState(0);
    const [error, setError] = useState<string>();

    const updatePost = useMemo(() => {
        return (id: number, partial: Partial<PostInfo>) => {
            if (!posts) {
                return;
            }
            let postIndex = posts.findIndex(p => p.id === id);
            if (postIndex !== -1) {
                const newPost = {...posts[postIndex], ...partial};
                const newPosts = [...posts];
                newPosts[postIndex] = newPost;
                setPosts(newPosts);
            }
        };
    }, [posts]);

    useEffect(() => {
        console.log('feed request');
        setLoading(true);
        if (feedType === 'site') {
            api.post.feedPosts(site, page, perpage)
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
                    setError('Не удалось загрузить ленту постов');
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
                    setError('Не удалось загрузить ленту постов');
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
                    setError('Не удалось загрузить ленту постов');
                });
        }
    }, [site, feedType, page, api.post, perpage]);

    return { posts, loading, pages, error, updatePost };
}