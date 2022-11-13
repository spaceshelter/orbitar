import React, {useEffect, useState} from 'react';
import styles from './PostPage.module.scss';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostInfo, PostLinkInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import {CreateCommentComponentRestricted} from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';
import {useAppState} from '../AppState/AppState';

export default function PostPage() {
    const params = useParams<{postId: string}>();
    const [search] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;
    const location = useLocation();
    const [scrolledToComment, setScrolledToComment] = useState<{postId: number, commentId: number}>();
    const [answerOpen, setAnswerOpen] = useState(false);
    const {site} = useAppState();

    const unreadOnly = search.get('new') !== null;
    const {post, comments, postComment, editComment, editPost, error, reload, updatePost} = usePost(site, postId, unreadOnly);

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

    const handleAnswerSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setAnswerOpen(!answerOpen);
    };

    const handleCommentEdit = async (text: string, comment: CommentInfo) => {
        return await editComment(text, comment.id);
    };

    const handleAnswer = async (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
        if (!post) {
            return;
        }

        const newComment = await postComment(text, comment?.id);
        setTimeout(() => {
            const el = document.querySelector(`div[data-comment-id="${newComment.id}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
        return comment;
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

    const handlePostEdit = async (post: PostInfo, text: string, title?: string): Promise<PostInfo | undefined> => {
        return await editPost(title || '', text);
    };

    const baseRoute = site === 'main' ? '/' : `/s/${site}/`;

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} onChange={(_, partial) => updatePost(partial)} onEdit={handlePostEdit} />
                        <div className={styles.postButtons}><Link to={`${baseRoute}p${post.id}`} className={unreadOnly ? '' : 'bold'}>все комментарии</Link> • <Link to={`${baseRoute}p${post.id}?new`} className={unreadOnly ? 'bold' : ''}>только новые</Link>
                            {comments && comments.length > 0 && <> • <PostAnswerButton answerOpen={answerOpen} handleAnswerSwitch={handleAnswerSwitch} /></>}
                        </div>

                        <div className={styles.comments + (unreadOnly ? ' unreadOnly' : '')}>
                            {comments ?
                                comments.map(comment => <CommentComponent maxTreeDepth={12} key={comment.id} comment={comment} onAnswer={handleAnswer} unreadOnly={unreadOnly} onEdit={handleCommentEdit} />)
                                :
                                (
                                    error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                                        : <div className={styles.loading}>Загрузка...</div>
                                )
                            }
                        </div>
                        <PostAnswerButton answerOpen={answerOpen} handleAnswerSwitch={handleAnswerSwitch} />
                        <CreateCommentComponentRestricted open={answerOpen} post={post} onAnswer={handleAnswer} />
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

const PostAnswerButton = (props: {answerOpen: boolean, handleAnswerSwitch: (e: React.MouseEvent) => void } ) => {
    return <button className={styles.postAnswer} onClick={props.handleAnswerSwitch}>{!props.answerOpen ? 'Комментировать пост' : 'Не комментировать'}</button>;
};
