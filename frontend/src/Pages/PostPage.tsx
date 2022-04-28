import React, {useEffect, useState} from 'react';
import styles from './PostPage.module.css';
import {useMatch, useSearch} from 'react-location';
import {useAPI} from '../AppState/AppState';
import {SiteInfo} from '../Types/SiteInfo';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import SiteSidebar from './SiteSidebar';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import CreateCommentComponent from '../Components/CreateCommentComponent';
import {Link} from 'react-location';

export default function PostPage() {
    const api = useAPI();
    const match = useMatch();
    const search = useSearch<{Search: {'new': string | undefined}}>();
    const [site, setSite] = useState<SiteInfo>();
    const [post, setPost] = useState<PostInfo>();
    const [comments, setComments] = useState<CommentInfo[]>();
    const [showComments, setShowComments] = useState<CommentInfo[]>();
    const postId = parseInt(match.params.postId);
    const [isNew, setIsNew] = useState(search.new !== undefined);
    console.log('POST', postId, search);

    useEffect(() => {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        let siteInfo = api.cache.getSite(site);
        if (siteInfo) {
            setSite(siteInfo);
        }

        let postInfo = api.cache.getPost(postId);
        if (postInfo) {
            setPost(postInfo);
        }

        api.post.get(postId)
            .then(result => {
                setPost(result.post);
                setSite(result.site);
                setComments(result.comments);

                api.post.read(postId, result.post.comments, result.lastCommentId)
                    .then(res => {
                        console.log('READ', res);
                    });

                console.log('POST', result);
            })
            .catch(error => {
                console.log('POST ERR', error);
            });
    }, [api, match.params.postId]);

    useEffect(() => {
        console.log('NEW', search.new !== undefined);
        let sNew = search.new !== undefined;
        setIsNew(sNew);

        if (!comments) {
            return;
        }

        if (!sNew) {
            setShowComments(comments);
            return;
        }

        let newComments: CommentInfo[] = [];

        const needShow = (comment: CommentInfo) => {
            if (comment.isNew) {
                return comment;
            }
            if (comment.answers) {
                const answers: CommentInfo[] = [];
                for (let answer of comment.answers) {
                    let need = needShow(answer);
                    if (need) {
                        answers.push(need);
                    }
                }
                if (answers.length > 0) {
                    return { ...comment, answers: answers };
                }
            }
            return false;
        }

        for (let comment of comments) {
            let need = needShow(comment);
            if (need) {
                newComments.push(need);
            }
        }

        setShowComments(newComments);
    }, [search.new, comments])

    const handleAnswer = (text: string, post: PostInfo, comment?: CommentInfo) => {
        console.log('POST HANDLE ANSWER', text, post, comment);

        return new Promise<CommentInfo>((resolve, reject) => {
            api.post.comment(text, post.id, comment?.id)
                .then(result => {
                    let newComments;
                    if (comment) {
                        if (!comment.answers) {
                            comment.answers = [];
                        }
                        comment.answers.push(result.comment);
                        newComments = [...comments!];
                    }
                    else {
                        newComments = [...comments!];
                        newComments.push(result.comment);
                    }

                    if (newComments) {
                        setComments(newComments);

                        const commentsCounter: ((comments: CommentInfo[]) => number) = (comments: CommentInfo[]) => {
                            return comments.reduce<number>((p, c) => {
                                return p + (c.answers ? commentsCounter(c.answers) : 0);
                            }, comments.length);
                        }

                        const totalComments = commentsCounter(newComments);
                        if (totalComments) {
                            api.post.read(postId, totalComments)
                                .then(res => {
                                    console.log('READ', res);
                                });
                        }
                    }



                    resolve(result.comment);
                })
                .catch(error => {
                    reject(error);
                });

        });
    };

    return (
        <div className={styles.container}>
            {site && <SiteSidebar site={site} />}

            <div className={styles.feed}>
                {post ? <div>
                        <PostComponent key={post.id} post={post} buttons={
                            <div className={styles.postButtons}><Link to={`/post/${post.id}`} className={isNew ? '' : 'bold'}>Все комментарии</Link> / <Link to={`/post/${post.id}?new`} className={isNew ? 'bold' : ''}>новые</Link></div>
                        } />

                        <div className={styles.comments}>
                            {showComments ?
                                showComments.map(comment => <CommentComponent key={comment.id} comment={comment} post={post} onAnswer={handleAnswer} />)
                                :
                                <div>Загрузка...</div>
                            }
                        </div>
                        <CreateCommentComponent open={true} post={post} onAnswer={handleAnswer} />
                    </div>
                    :
                    <div className={styles.loading}>Загрузка</div>
                }
            </div>
        </div>
    )
}

