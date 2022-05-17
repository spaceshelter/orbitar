import {CommentInfo, PostInfo} from '../../Types/PostInfo';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useAPI} from '../../AppState/AppState';
import {SiteInfo} from '../../Types/SiteInfo';
import {useCache} from './useCache';

type UsePost = {
    site?: SiteInfo;
    post?: PostInfo;
    comments?: CommentInfo[];
    error?: string;

    postComment(comment: string, answerToCommentId?: number): Promise<CommentInfo>;
    editComment(comment: string, commentId: number): Promise<CommentInfo>;
    editPost(title: string, content: string): Promise<PostInfo>;
    setVote(value: number): void;
    setCommentVote(commentId: number, vote: number): void;
    reload(showUnreadOnly?: boolean): void;
    updatePost(partial: Partial<PostInfo>): void;
};

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

export function usePost(siteName: string, postId: number, showUnreadOnly?: boolean): UsePost {
    const api = useAPI();
    const [post, setPost] = useState<PostInfo>();
    const [site, setSite] = useState<SiteInfo>();
    const [cachedComments, setCachedComments] = useCache<CommentInfo[]>('post', [siteName, postId, !!showUnreadOnly]);
    const [rawComments, setRawComments] = useState<CommentInfo[] | undefined>(cachedComments);
    const filteredComments: CommentInfo[] | undefined = cachedComments ? filterComments(cachedComments, !!showUnreadOnly) : undefined;
    const [comments, setComments] = useState<CommentInfo[] | undefined>(filteredComments);
    const [error, setError] = useState<string>();

    const prev = usePrevious({ siteName, postId, showUnreadOnly });

    const updatePost = useMemo(() => {
        return (partial: Partial<PostInfo>) => {
            if (!post) {
                return;
            }
            const newPost = {...post, ...partial};
            setPost(newPost);
        };
    }, [post]);

    const { postComment, editComment, editPost, setVote, setCommentVote, reload } = useMemo(() => {
        const postComment = async (text: string, answerToCommentId?: number) => {
            const {comment} = await api.post.comment(text, postId, answerToCommentId);

            if (rawComments) {
                const totalComments = countComments(rawComments) + 1;
                api.post.read(postId, totalComments).then();
            }

            if (!comments) {
                // no comments loaded!
                return comment;
            }

            if (answerToCommentId) {
                // find comment with id
                const parentComment = findComment(comments, answerToCommentId);
                if (!parentComment) {
                    // parent comment not found for some reason
                    return comment;
                }

                // add to parent
                if (!parentComment.answers) {
                    parentComment.answers = [comment];
                }
                else {
                    parentComment.answers.push(comment);
                }
                // update comments
                setComments([...comments]);

                if (rawComments) {
                    // in normal situation rawComments should contain new comment already
                    // so we only update ref here
                    const updateComments = [...rawComments];
                    setRawComments(updateComments);
                    setCachedComments(updateComments);
                }

                return comment;
            }

            setComments([...comments, comment]);
            if (rawComments) {
                setRawComments([...rawComments, comment]);
            }

            return comment;
        };

        const editComment = async (text: string, commentId: number) => {
            const {comment} = await api.post.editComment(text, commentId);

            if (!comments) {
                // no comments loaded!
                return comment;
            }

            if (comments) {
                const originalComment = findComment(comments, commentId);
                if (originalComment) {
                    Object.assign(originalComment, comment);
                    setComments([...comments]);
                }
            }

            if (rawComments) {
                const originalComment = findComment(rawComments, commentId);
                if (originalComment) {
                    Object.assign(originalComment, comment);
                    setRawComments([...rawComments]);
                }
            }

            return comment;
        };

        const editPost = async (title: string, text: string) => {
            const {post} = await api.post.editPost(title, text, postId);
            setPost(post);
            return post;
        };

        const setVote = (vote: number) => {

        };

        const setCommentVote = (commentId: number, vote: number) => {

        };

        const reload = (unreadOnly?: boolean) => {
            // reset error
            setError(undefined);
            // request post
            api.post.get(postId)
                .then(result => {
                    setPost(result.post);
                    setSite(result.site);
                    setCachedComments(result.comments);
                    setRawComments(result.comments);

                    setComments(filterComments(result.comments, unreadOnly || false));

                    // mark all comments as read
                    api.post.read(postId, result.post.comments, result.lastCommentId).then();
                })
                .catch(error => {
                    console.error('Could not load post', postId, error);
                    setError(error.message || 'Произошла ошибка при загрузке поста');
                });
        };

        return { postComment, editComment, editPost, setVote, setCommentVote, reload, updatePost };
    }, [postId, comments, rawComments, api.post]);

    useEffect(() => {
        if (prev && (prev.siteName === siteName && prev.postId === postId && prev.showUnreadOnly === showUnreadOnly)) {
            return;
        }

        if (prev?.siteName !== siteName) {
            // load site from cache
            const siteInfo = api.cache.getSite(siteName);
            setSite(siteInfo);
        }

        if (prev?.postId !== postId) {
            // load post from cache
            const postInfo = api.cache.getPost(postId);
            setPost(postInfo);
            // reset comments
            setRawComments(undefined);
            setComments(undefined);
        }
        else if (rawComments) {
            // use raw comments if postId not changed
            setComments(filterComments(rawComments, showUnreadOnly || false));
            return;
        }

        if (prev?.postId === postId) {
            // TODO: skip only if in loading state
            return;
        }

        // request post
        reload(showUnreadOnly || false);
    }, [siteName, postId, showUnreadOnly, api, rawComments, prev, reload]);

    return { site, post, comments, error, postComment, editComment, editPost, setVote, setCommentVote, reload, updatePost };
}

function findComment(comments: CommentInfo[], commentId: number): CommentInfo | undefined {
    for (const comment of comments) {
        if (comment.id === commentId) {
            return comment;
        }

        if (comment.answers) {
            const found = findComment(comment.answers, commentId);
            if (found) {
                return found;
            }
        }
    }
}

function filterComments(comments: CommentInfo[], unreadOnly: boolean): CommentInfo[] {
    if (!unreadOnly) {
        return comments;
    }

    const newComments: CommentInfo[] = [];

    const needShow = (comment: CommentInfo) => {
        if (comment.isNew) {
            return comment;
        }
        if (comment.answers) {
            const answers: CommentInfo[] = [];
            for (const answer of comment.answers) {
                const need = needShow(answer);
                if (need) {
                    answers.push(need);
                }
            }
            if (answers.length > 0) {
                return { ...comment, answers: answers };
            }
        }
        return false;
    };

    for (const comment of comments) {
        const need = needShow(comment);
        if (need) {
            newComments.push(need);
        }
    }

    return newComments;
}

function countComments(comments: CommentInfo[]) {
    let result = comments.length;
    for (const comment of comments) {
        if (comment.answers) {
            result += countComments(comment.answers);
        }
    }
    return result;
}