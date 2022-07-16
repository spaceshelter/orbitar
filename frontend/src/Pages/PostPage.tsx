import React, {useEffect, useState} from 'react';
import styles from './PostPage.module.css';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostInfo, PostLinkInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import CreateCommentComponent from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';
import {useAppState} from '../AppState/AppState';

export default function PostPage() {
    const params = useParams<{postId: string}>();
    const [search] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;
    const location = useLocation();
    const [scrolledToComment, setScrolledToComment] = useState<{postId: number, commentId: number}>();
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
                    el.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const [selected, setSelected] = useState<[HTMLDivElement, HTMLDivElement] | undefined>();

    function setParentPosition(parent: HTMLDivElement, child: HTMLDivElement) {
        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        const maxGap = 30;

        if (childRect.top >= parentRect.height + maxGap) {
            parent.style.top = '0px';
        } else {
            parent.style.top = `${childRect.top - parentRect.height - maxGap}px`;
        }
        return childRect;
    }

    const toggleParentSelection = (parent: HTMLDivElement | undefined, child: HTMLDivElement | undefined) => {

        if (selected) {
            selected[0].parentElement?.classList.remove('selected');
            selected[1].classList.remove('selectedChild');
            selected[0].style.top = '';
        }

        if (parent && child) {
            setSelected([parent, child]);
            parent?.parentElement?.classList.add('selected');
            child?.classList.add('selectedChild');
            setParentPosition(parent, child);
        }
    };

    const onScroll = () => {
        // set the relative position of the comment such that it's on top of the screen
        if (selected) {
            const [parent, child] = selected;
            const childRect = setParentPosition(parent, child);

            const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
            // check if child is out of viewport
            if (childRect.top > vh || childRect.bottom < 0) {
                toggleParentSelection(undefined, undefined);
            }
        }
    };

    useEffect(() => {
        if (selected) {
            document.addEventListener('scroll', onScroll);
            onScroll();
            return () => {
                document.removeEventListener('scroll', onScroll);
            };
        }
    }, [selected]);

    return (
        <div className={styles.container}>
            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} onChange={(_, partial) => updatePost(partial)} onEdit={handlePostEdit} />
                        <div className={styles.postButtons}><Link to={`${baseRoute}p${post.id}`} className={unreadOnly ? '' : 'bold'}>все комментарии</Link> • <Link to={`${baseRoute}p${post.id}?new`} className={unreadOnly ? 'bold' : ''}>только новые</Link></div>
                        <div className={styles.comments + (unreadOnly ? ' unreadOnly' : '')}>
                            {comments ?
                                comments.map(comment => <CommentComponent maxTreeDepth={12} key={comment.id} comment={comment} onAnswer={handleAnswer} onEdit={handleCommentEdit}
                                    toggleParentSelection={toggleParentSelection}/>)
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
    );
}

