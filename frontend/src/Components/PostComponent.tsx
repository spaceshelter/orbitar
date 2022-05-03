import styles from './PostComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React, {useMemo} from 'react';
import {PostInfo} from '../Types/PostInfo';
import {Link} from "react-router-dom";
import DateComponent from './DateComponent';
import ContentComponent from './ContentComponent';
import {ReactComponent as CommentsIcon} from '../Assets/comments.svg';
import {ReactComponent as BookmarkIcon} from '../Assets/bookmark.svg';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {ReactComponent as OptionsIcon} from '../Assets/options.svg';
import PostLink from './PostLink';

interface PostComponentProps {
    post: PostInfo;
    showSite?: boolean;
    buttons?: React.ReactNode;
}

export default function PostComponent(props: PostComponentProps) {
    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            props.post.rating = value;
            props.post.vote = vote;
        }
    }, [props.post]);

    const { id, created, site, comments, newComments, author, title } = props.post;

    if (!comments) {

    }

    return (
        <div className={styles.post}>
            <div className={styles.header}>
                <div className={styles.signature}>
                    {props.showSite ? <><Link to={`//${site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{site}</Link> • </> : ''}
                    <Username user={author} /> • <PostLink post={props.post}><DateComponent date={created} /></PostLink>
                </div>
                <div className={styles.contentContainer}>
                    {title && <div className={styles.title}><PostLink post={props.post}>{title}</PostLink></div>}
                    <ContentComponent className={styles.content} content={props.post.content} />
                </div>
            </div>
            <div className={styles.controls}>
                <div className={styles.control}>
                    <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} onVote={handleVote} />
                </div>
                <div className={styles.control}><CommentsCount post={props.post} /></div>
                <div className={styles.control}><button disabled={true}><BookmarkIcon /><span className={styles.label}>0</span></button></div>
                <div className={styles.control}><button disabled={true}><EditIcon /></button></div>
                <div className={styles.control}><button disabled={true}><OptionsIcon /></button></div>
            </div>
            {props.buttons}
        </div>
    )
}

function CommentsCount(props: {post: PostInfo}) {
    const {comments, newComments} = props.post;

    if (!comments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={styles.label}>Комментировать</span></PostLink>;
    }

    if (!newComments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    if (newComments === comments) {
        return <PostLink className={styles.active} post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    return <><PostLink className={styles.active} post={props.post} onlyNew={true}><CommentsIcon /><span className={styles.label}>{newComments}</span></PostLink> / <PostLink post={props.post}>{comments}</PostLink></>;
}
