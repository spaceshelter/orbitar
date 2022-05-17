import React, {useEffect, useState} from 'react';
import styles from './PostPage.module.css';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostLinkInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import CreateCommentComponent from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';

export default function PostPage() {
    const params = useParams<{postId: string}>();
    const [search] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;
    const location = useLocation();
    const [scrolledToComment, setScrolledToComment] = useState<{postId: number, commentId: number}>();

    let subdomain = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        subdomain = window.location.hostname.split('.')[0];
    }

    const unreadOnly = search.get('new') !== null;
    const {post, comments, postComment, preview, error, reload, updatePost} = usePost(subdomain, postId, unreadOnly);

    useEffect(() => {
        let docTitle = `Пост #${postId}`;
        if (post) {
            if (post.title) {
                docTitle = post.title;
            }
            docTitle += ' / ' + post.author.username;
        }
        document.title = docTitle;

    }, [post, postId]);

    const handleAnswer = (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
        if (!post) {
            return Promise.resolve(undefined);
        }
        return new Promise<CommentInfo>((resolve, reject) => {
            postComment(text, comment?.id)
                .then(comment => {
                    // scroll to new comment
                    setTimeout(() => {
                        const el = document.querySelector(`div[data-comment-id="${comment.id}"]`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);

                    resolve(comment);
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    useEffect(() => {
        if (!comments) {
            return;
        }

        if (location.hash) {
            const commentId = parseInt(location.hash.substring(1));

            if (scrolledToComment && scrolledToComment.postId === postId && scrolledToComment.commentId === commentId) {
                return;
            }

            const el = document.querySelector(`[data-comment-id="${commentId}"] .commentBody`);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight');

                    setTimeout(() => {
                        el.classList.remove('highlight');
                        setScrolledToComment({postId, commentId});
                    }, 5000);
                }, 100);
            }
        }
        else if (unreadOnly) {
            // find new comment
            const el = document.querySelector(`.isNew`);
            if (el) {
                const commentId = parseInt(el.getAttribute('data-comment-id') || '');
                if (!commentId) {
                    return;
                }

                if (scrolledToComment && scrolledToComment.postId === postId && scrolledToComment.commentId === commentId) {
                    return;
                }

                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    setTimeout(() => {
                        setScrolledToComment({postId, commentId});
                    }, 5000);
                }, 100);
            }

        }
    }, [location.hash, comments, scrolledToComment, unreadOnly]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} onChange={(_, partial) => updatePost(partial)} />
                        <div className={styles.postButtons}><Link to={`/post/${post.id}`} className={unreadOnly ? '' : 'bold'}>все комментарии</Link> • <Link to={`/post/${post.id}?new`} className={unreadOnly ? 'bold' : ''}>только новые</Link></div>
                        <div className={styles.comments + (unreadOnly ? ' unreadOnly' : '')}>
                            {comments ?
                                comments.map(comment => <CommentComponent key={comment.id} comment={comment} onAnswer={handleAnswer} onPreview={preview} />)
                                :
                                (
                                    error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                                        : <div className={styles.loading}>Загрузка...</div>
                                )
                            }
                        </div>
                        <CreateCommentComponent open={true} post={post} onAnswer={handleAnswer} onPreview={preview} />
                    </div>
                    :
                    (
                        error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                        : <div className={styles.loading}>Загрузка...</div>
                    )
                }
            </div>
        </div>
    );
}

