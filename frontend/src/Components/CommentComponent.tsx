import {CommentInfo, PostInfo} from '../Types/PostInfo';
import styles from './CommentComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import {Link} from 'react-router-dom';
import React, {useMemo, useState} from 'react';
import CreateCommentComponent from './CreateCommentComponent';
import DateComponent from './DateComponent';
import ContentComponent from './ContentComponent';
import PostLink from './PostLink';
import {useAppState} from '../AppState/AppState';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';

interface CommentProps {
    post: PostInfo;
    comment: CommentInfo;

    onAnswer: (text: string, post: PostInfo, comment?: CommentInfo) => Promise<CommentInfo>;
}

export default function CommentComponent(props: CommentProps) {
    const [answerOpen, setAnswerOpen] = useState(false);
    const {site} = useAppState();

    const handleAnswerSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setAnswerOpen(!answerOpen);
    };

    const handleAnswer = (text: string, post: PostInfo, comment?: CommentInfo) => {
        return new Promise<CommentInfo>((resolve, reject) => {
            props.onAnswer(text, post, comment)
                .then(result => {
                    setAnswerOpen(false);
                    resolve(result);
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            props.comment.rating = value;
            props.comment.vote = vote;
        }
    }, [props.comment]);

    const showSite = false;
    const {author, created} = props.comment;

    return (
        <div className={styles.comment + (props.comment.isNew ? ' ' + styles.isNew : '')} data-comment-id={props.comment.id}>
            <div className={styles.body}>
                <div className={styles.signature}>
                    {showSite ? <><Link to={`//${site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{site}</Link> • </> : ''}
                    <Username user={author} /> • <PostLink post={props.post}><DateComponent date={created} /></PostLink>
                    { props.comment.isNew && <> • <span className={styles.newComment}>новый</span></>}
                </div>
                <div className={styles.content}>
                    <ContentComponent className={styles.commentContent} content={props.comment.content} />
                </div>
                <div className={styles.controls}>
                    <div className={styles.control}>
                        <RatingSwitch type="comment" id={props.comment.id} rating={{ vote: props.comment.vote, value: props.comment.rating }} onVote={handleVote} />
                    </div>
                    <div className={styles.control}><button disabled={true}><EditIcon /></button></div>
                    <div className={styles.control}><button onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</button></div>
                </div>
            </div>
            {(props.comment.answers || answerOpen) ?
                <div className={styles.answers}>
                    <CreateCommentComponent open={answerOpen} comment={props.comment} post={props.post} onAnswer={handleAnswer} />
                    {props.comment.answers ? props.comment.answers.map(comment => <CommentComponent key={comment.id} comment={comment} post={props.post} onAnswer={props.onAnswer} />) : <></>}
                </div>
                : <></>}

        </div>
    )
}

