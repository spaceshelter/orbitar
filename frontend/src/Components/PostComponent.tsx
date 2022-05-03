import styles from './PostComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React, {useMemo} from 'react';
import {PostInfo} from '../Types/PostInfo';
import {Link} from "react-location";
import DateComponent from './DateComponent';
import ContentComponent from './ContentComponent';
import {ReactComponent as CommentsIcon} from '../Assets/comments.svg';
import {ReactComponent as BookmarkIcon} from '../Assets/bookmark.svg';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {ReactComponent as OptionsIcon} from '../Assets/options.svg';

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
                    {props.showSite ? <><a href={`//${site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{site}</a> • </> : ''}
                    <Username user={author} /> • <Link to={'/post/' + id}><DateComponent date={created} /></Link>
                </div>
                <div className={styles.contentContainer}>
                    {title && <div className={styles.title}>{title}</div>}
                    <ContentComponent className={styles.content} content={props.post.content} />
                </div>
            </div>
            <div className={styles.controls}>
                <div className={styles.control}>
                    <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} onVote={handleVote} />
                </div>
                <div className={styles.control}><CommentsCount id={id} newComments={newComments} comments={comments} /></div>
                <div className={styles.control}><button disabled={true}><BookmarkIcon /><span className={styles.label}>0</span></button></div>
                <div className={styles.control}><button disabled={true}><EditIcon /></button></div>
                <div className={styles.control}><button disabled={true}><OptionsIcon /></button></div>
            </div>
            {props.buttons}
        </div>
    )
}

function CommentsCount(props: {id: number, newComments: number, comments: number}) {
    if (!props.comments) {
        return <Link to={'/post/' + props.id}><CommentsIcon /><span className={styles.label}>Комментировать</span></Link>;
    }

    if (!props.newComments) {
        return <Link to={'/post/' + props.id}><CommentsIcon /><span className={styles.label}>{props.comments}</span></Link>;
    }

    if (props.newComments === props.comments) {
        return <Link className={styles.active} to={'/post/' + props.id}><CommentsIcon /><span className={styles.label}>{props.comments}</span></Link>;
    }

    return <><Link className={styles.active} to={'/post/' + props.id + '?new'}><CommentsIcon /><span className={styles.label}>{props.newComments}</span></Link> / <Link to={'/post/' + props.id}>{props.comments}</Link></>;
}
