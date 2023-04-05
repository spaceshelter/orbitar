import React, {useEffect, useRef} from 'react';
import styles from './PostPage.module.css';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {CommentInfo, PostInfo, PostLinkInfo} from '../Types/PostInfo';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import {CreateCommentComponentRestricted} from '../Components/CreateCommentComponent';
import {usePost} from '../API/use/usePost';
import {useAppState} from '../AppState/AppState';
import Username from '../Components/Username';

export default function PostPage() {
    const params = useParams<{postId: string}>();
    const [search] = useSearchParams();
    const postId = params.postId ? parseInt(params.postId, 10) : 0;
    const location = useLocation();
    const {site} = useAppState();
    const containerRef = useRef<HTMLDivElement>(null);
    const unreadOnly = search.get('new') !== null;
    const {post, comments, anonymousUser, postComment, editComment, editPost, error, reload, updatePost} = usePost(site, postId, unreadOnly);

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

        let scrollToComment: HTMLDivElement | null | undefined;
        if (location.hash) {
            const commentId = parseInt(location.hash.substring(1));
            scrollToComment = document.querySelector<HTMLDivElement>(`[data-comment-id="${commentId}"]`);
        }
        else if (unreadOnly) {
            // find first new comment
             scrollToComment = document.querySelector<HTMLDivElement>(`.isNew`);
        }
        // do nothing if element is focused already
        if(!scrollToComment || scrollToComment.className.indexOf(styles.focusing) >= 0) {
            return;
        }

        const commentBody = scrollToComment.querySelector<HTMLDivElement>('.commentBody');
        if (!commentBody) {
            return;
        }
        const containerNode = containerRef.current;
        // disable anchoring for all post&comments and anchor the comment
        containerNode?.classList.add(styles.focusing);
        scrollToComment.classList.add(styles.focused);
        commentBody.classList.add(styles.highlight);

        // do not use `smooth` here - it is too slow and element won't focus into view correctly
        commentBody.scrollIntoView({behavior: 'auto', block: 'start'});
        // compensate for topbar height - otherwise element will be partially covered
        const topbarHeight = document.getElementById('topbar')?.clientHeight;

        if(topbarHeight) {
            window.scrollBy({top: -topbarHeight - 10});
        }

        return () => {
            commentBody.classList.remove(styles.highlight);
            containerNode?.classList.remove(styles.focusing);
            scrollToComment?.classList.remove(styles.focused);
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
                            {comments ?
                                comments.map(comment => <CommentComponent maxTreeDepth={12} key={comment.id} comment={comment} onAnswer={handleAnswer} unreadOnly={unreadOnly} onEdit={handleCommentEdit} />)
                                :
                                (
                                    error ? <div className={styles.error}>{error}<div><button onClick={() => reload(unreadOnly)}>Повторить</button></div></div>
                                        : <div className={styles.loading}>Загрузка...</div>
                                )
                            }
                        </div>
                        <CreateCommentComponentRestricted open={true} post={post} onAnswer={handleAnswer} storageKey={`c:${post.id}`} />
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

