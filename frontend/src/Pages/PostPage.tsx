import React, {useEffect, useState} from 'react';
import styles from './PostPage.module.css';
import {useMatch} from 'react-location';
import {useAPI} from '../AppState/AppState';
import {SiteInfo} from '../Types/SiteInfo';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import SiteSidebar from './SiteSidebar';
import PostComponent from '../Components/PostComponent';
import CommentComponent from '../Components/CommentComponent';
import CreateCommentComponent from '../Components/CreateCommentComponent';

export default function PostPage() {
    const api = useAPI();
    const {params: {postId}} = useMatch();
    const [site, setSite] = useState<SiteInfo>();
    const [post, setPost] = useState<PostInfo>();
    const [comments, setComments] = useState<CommentInfo[]>();
    console.log('POST', postId);

    useEffect(() => {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        let siteInfo = api.cache.getSite(site);
        if (siteInfo) {
            setSite(siteInfo);
        }

        let postInfo = api.cache.getPost(parseInt(postId));
        if (postInfo) {
            setPost(postInfo);
        }

        api.post.get(parseInt(postId))
            .then(result => {
                setPost(result.post);
                setSite(result.site);
                setComments(result.comments);

                console.log('POST', result);
            })
            .catch(error => {
                console.log('POST ERR', error);
            });
    }, [api, postId]);

    const handleAnswer = (text: string, post: PostInfo, comment?: CommentInfo) => {
        console.log('POST HANDLE ANSWER', text, post, comment);

        return new Promise<CommentInfo>((resolve, reject) => {
            api.post.comment(text, post.id, comment?.id)
                .then(result => {
                    if (comment) {
                        if (!comment.answers) {
                            comment.answers = [];
                        }
                        comment.answers.push(result.comment);
                        let newComments = [...comments!];
                        setComments(newComments);
                    }
                    else {
                        let newComments = [...comments!];
                        newComments.push(result.comment);
                        setComments(newComments);
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
                    <PostComponent key={post.id} post={post} />
                    <div className={styles.comments}>
                        {comments ?
                            comments.map(comment => <CommentComponent key={comment.id} comment={comment} post={post} onAnswer={handleAnswer} />)
                            :
                            <div>Загрузка...</div>
                        }
                    </div>
                    <CreateCommentComponent open={true} post={post} onAnswer={handleAnswer} />
                </div>
                    : <div className={styles.loading}>Загрузка</div>
                }
            </div>
        </div>
    )
}

