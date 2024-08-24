import React, {createContext, useEffect, useMemo, useRef, useState} from 'react';
import styles from './PostPage.module.css';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostInfo, PostLinkInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import {CreateCommentComponentRestricted} from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';
import {useAppState} from '../AppState/AppState';
import Username from '../Components/Username';
import {scrollUnderTopbar} from '../Utils/utils';
import {InView} from 'react-intersection-observer';

const THREAD_GROUP_SIZE = 10;

export const InviewContext = createContext<boolean>(true);

export default function PostPage() {
    const params = useParams<{postId: string}>();
    const [search] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;
    const location = useLocation();
    const [scrolledToComment, setScrolledToComment] = useState<{postId: number, commentId: number}>();
    const {site, userInfo} = useAppState();
    const containerRef = useRef<HTMLDivElement>(null);
    const unreadOnly = search.get('new') !== null;
    const {post, comments, anonymousUser, postComment, editComment, editPost, error, reload, updatePost} = usePost(site, postId, unreadOnly);

    // Group top-level threads to render some content inside only when they are in view
    const groupedComments = useMemo(() => {
        if (!comments) {
            return;
        }
        const groups: CommentInfo[][] = [];
        for (let i = 0; i < comments.length; i += THREAD_GROUP_SIZE) {
            groups.push(comments.slice(i, i + THREAD_GROUP_SIZE));
        }
        return groups;
    }, [comments]);

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
        console.log('>>> scrolling to comment', location.hash, comments);

        if (!comments) {
            console.log('no comments');
            return;
        }

        let commentToScrollTo: HTMLDivElement | null | undefined;
        let commentId: number | undefined;
        if (location.hash) {
            commentId = parseInt(location.hash.substring(1));
            commentToScrollTo = document.querySelector<HTMLDivElement>(`[data-comment-id="${commentId}"]`);
            console.log('scrollToComment', commentToScrollTo);
        } else if (unreadOnly) {
            // find first new comment
             commentToScrollTo = document.querySelector<HTMLDivElement>(`.isNew`);
             commentId = commentToScrollTo?.dataset.commentId ? parseInt(commentToScrollTo.dataset.commentId) : undefined;
             console.log('unreadOnly', commentToScrollTo, commentId);
        }
        // do nothing if element is focused already
        if (!commentToScrollTo || commentToScrollTo.className.indexOf(styles.focusing) >= 0 ||
            (scrolledToComment?.postId === postId && scrolledToComment?.commentId === commentId)
        ) {
            console.log('do nothing', scrolledToComment, {postId, commentId}, commentToScrollTo);
            // debug condition
            if (!commentToScrollTo) {
                console.log('no commentToScrollTo');
            }
            if (commentToScrollTo && commentToScrollTo.className.indexOf(styles.focusing) >= 0) {
                console.log('focusing');
            }
            if (scrolledToComment?.postId === postId && scrolledToComment?.commentId === commentId) {
                console.log('already scrolled', scrolledToComment, {postId, commentId});
            }
            setScrolledToComment(commentId && commentToScrollTo ? {postId, commentId} : undefined);
            return;
        }

        const commentBody = commentToScrollTo.querySelector<HTMLDivElement>('.commentBody');
        if (!commentBody) {
            console.log('no commentBody', commentToScrollTo);
            return;
        }
        const containerNode = containerRef.current;
        // disable anchoring for all post&comments and anchor the comment
        containerNode?.classList.add(styles.focusing);
        commentToScrollTo.classList.add(styles.focused);
        commentBody.classList.add(styles.highlight);

        setScrolledToComment(commentId && commentToScrollTo? {postId, commentId} : undefined);

        console.log('scrolling to comment', commentToScrollTo);
        scrollUnderTopbar(() => {
            console.log(commentId);
            const commentToScrollTo = document.querySelector<HTMLDivElement>(`[data-comment-id="${commentId}"]`);
            console.log(commentToScrollTo);
            const res = commentToScrollTo?.querySelector<HTMLDivElement>('.commentBody') || null;
            console.log(res);
            return res;
        });

        return () => {
            commentBody.classList.remove(styles.highlight);
            containerNode?.classList.remove(styles.focusing);
            commentToScrollTo?.classList.remove(styles.focused);
        };
    }, [location.hash, comments, unreadOnly, postId]);

    const handlePostEdit = async (post: PostInfo, text: string, title?: string): Promise<PostInfo | undefined> => {
        return await editPost(title || '', text);
    };

    const baseRoute = site === 'main' ? '/' : `/s/${site}/`;

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} onChange={(_, partial) => updatePost(partial)} onEdit={handlePostEdit} />
                        {anonymousUser && <div className={styles.anon}><span className={'i i-anon'}></span> Внимание, анонимность!<br/>Комментарии в этом посте публикуются лица <Username user={anonymousUser}/>.</div>}
                        <div className={styles.postButtons}><Link to={`${baseRoute}p${post.id}`} className={unreadOnly ? '' : 'bold'}>все комментарии</Link> • <Link to={`${baseRoute}p${post.id}?new`} className={unreadOnly ? 'bold' : ''}>только новые</Link></div>
                        <div className={styles.comments + (unreadOnly ? ' unreadOnly' : '')}>
                            {groupedComments ?
                                groupedComments.map((comments, ii) =>
                                  <InView key={ii} threshold={0.01} triggerOnce={true}>
                                      {({ inView, ref, entry }) => (
                                        <div ref={ref}>
                                            <InviewContext.Provider value={inView}>
                                              {comments.map(comment =>
                                                <CommentComponent maxTreeDepth={12} key={comment.id} comment={comment}
                                                                  onAnswer={handleAnswer} unreadOnly={unreadOnly} onEdit={handleCommentEdit}
                                                                  currentUsername={userInfo?.username} />
                                              )}
                                            </InviewContext.Provider>
                                        </div>
                                      )}
                                  </InView>
                                )
                                :
                                (
                                    error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                                        : <div className={styles.loading}>Загрузка...</div>
                                )
                            }
                        </div>
                        <CreateCommentComponentRestricted
                            parentAuthorUserName={post.author.username}
                            open={true} post={post} onAnswer={handleAnswer} storageKey={`c:${post.id}`} />
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

