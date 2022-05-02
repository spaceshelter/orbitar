import styles from './PostComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React, {useMemo} from 'react';
import {PostInfo} from '../Types/PostInfo';
import {UserGender} from '../Types/UserInfo';
import {Link} from "react-location";
import {pluralize} from '../Utils/utils';
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

    return (
        <div className={styles.post}>
            <div className={styles.header}>
                <div className={styles.signature}>
                    {props.showSite ? <><a href={`//${props.post.site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{props.post.site}</a> • </> : ''}
                    <Username user={props.post.author} /> • <Link to={'/post/' + props.post.id}><DateComponent date={props.post.created} /></Link>
                </div>
                <div className={styles.contentContainer}>
                    {props.post.title && <div className={styles.title}>
                        {props.post.title}
                    </div>}
                    <ContentComponent className={styles.content} content={props.post.content} />
                </div>
            </div>
            <div className={styles.controls}>
                <div className={styles.control}>
                    <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} onVote={handleVote} />
                </div>
                <div className={styles.control}><button><CommentsIcon /><span className={styles.label}>12 / 25</span></button></div>
                <div className={styles.control}><button><BookmarkIcon /><span className={styles.label}>0</span></button></div>
                <div className={styles.control}><button><EditIcon /></button></div>
                <div className={styles.control}><button><OptionsIcon /></button></div>
                {/*<div className={styles.signature}>*/}
                {/*    {props.showSite ? <><a href={`//${props.post.site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{props.post.site}</a> </> : ''}{props.post.author.gender === UserGender.she ? 'Написала' : 'Написал'} <Username user={props.post.author} />, <DateComponent date={props.post.created} />, <Link to={'/post/' + props.post.id}><CommentsCount count={props.post.comments} bold={props.post.comments > 0 && props.post.comments === props.post.newComments} /></Link>{props.post.newComments && props.post.newComments < props.post.comments ? <> / <Link to={'/post/' + props.post.id + '?new'}><NewCount count={props.post.newComments} bold={true} /></Link></> : ''}*/}
                {/*</div>*/}
            </div>
            {props.buttons}
        </div>
    )
}

function CommentsCount(props: {count: number, bold: boolean}) {
    let text = pluralize(props.count, ['комментарий', 'комментария', 'комментариев']);
    if (props.count === 0) {
        text = 'нет комментариев';
    }
    if (props.bold) {
        return <b>{text}</b>
    }
    else {
        return <>{text}</>
    }
}

function NewCount(props: {count: number, bold: boolean}) {
    const text = pluralize(props.count, ['новый', 'новых', 'новых']);
    if (props.bold) {
        return <b>{text}</b>
    }
    else {
        return <>{text}</>
    }
}