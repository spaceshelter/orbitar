import React from 'react';
import styles from './PostPage.module.css';
import {useParams, Link, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import CreateCommentComponent from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';
import {useAppState} from '../AppState/AppState';

export default function PostPage() {
    const {site} = useAppState();

    const params = useParams<{postId: string}>();
    const [search, setSearch] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;

    let subdomain = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        subdomain = window.location.hostname.split('.')[0];
    }

    const unreadOnly = search.get('new') !== undefined;
    const {post, comments, postComment, error, reload} = usePost(subdomain, postId, unreadOnly);

    const handleAnswer = (text: string, post: PostInfo, comment?: CommentInfo) => {
        return new Promise<CommentInfo>((resolve, reject) => {
            postComment(text, comment?.id)
                .then(comment => {
                    // scroll to new comment
                    setTimeout(() => {
                        const el = document.querySelector(`div[data-comment-id="${comment.id}"]`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        console.log('ELEMENT', el);
                    }, 100);

                    resolve(comment);
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} buttons={
                            <div className={styles.postButtons}><Link to={`/post/${post.id}`} className={unreadOnly ? '' : 'bold'}>Все комментарии</Link> / <Link to={`/post/${post.id}?new`} className={unreadOnly ? 'bold' : ''}>новые</Link></div>
                        } />

                        <div className={styles.comments}>
                            {comments ?
                                comments.map(comment => <CommentComponent key={comment.id} comment={comment} post={post} onAnswer={handleAnswer} />)
                                :
                                (
                                    error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                                        : <div className={styles.loading}>Загрузка...</div>
                                )
                            }
                        </div>
                        <CreateCommentComponent open={true} post={post} onAnswer={handleAnswer} />
                    </div>
                    :
                    (
                        error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                        : <div className={styles.loading}>Загрузка...</div>
                    )
                }
            </div>
        </div>
    )
}

