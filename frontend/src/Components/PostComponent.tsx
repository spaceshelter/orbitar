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

interface PostComponentProps {
    post: PostInfo;
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
                <div className={styles.contentContainer}>
                    {props.post.title && <div className={styles.title}>
                        {props.post.title}
                    </div>}
                    <ContentComponent className={styles.content} content={props.post.content} />
                </div>
            </div>
            <div className={styles.controls}>
                <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} onVote={handleVote} />
                <div className={styles.signature}>
                    {props.post.author.gender === UserGender.she ? 'Написала' : 'Написал'} <Username user={props.post.author} />, <DateComponent date={props.post.created} />, <Link to={'/post/' + props.post.id}><CommentsCount count={props.post.comments} bold={props.post.comments > 0 && props.post.comments === props.post.newComments} /></Link>{props.post.newComments && props.post.newComments < props.post.comments ? <> / <Link to={'/post/' + props.post.id + '?new'}><NewCount count={props.post.newComments} bold={true} /></Link></> : ''}
                </div>
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