import styles from './PostComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React from 'react';
import {PostInfo} from '../Types/PostInfo';
import {UserGender} from '../Types/UserInfo';
import {Link} from "react-location";

interface PostComponentProps {
    post: PostInfo;
}

export default function PostComponent(props: PostComponentProps) {
    return (
        <div className={styles.post}>
            <div className={styles.header}>
                <div className={styles.contentContainer}>
                    {props.post.title && <div className={styles.title}>
                        {props.post.title}
                    </div>}
                    <div className={styles.content} dangerouslySetInnerHTML={{__html: props.post.content}}>
                    </div>

                </div>
            </div>
            <div className={styles.controls}>
                <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} />
                <div className={styles.signature}>
                    {props.post.author.gender === UserGender.she ? 'Написала' : 'Написал'} <Username user={props.post.author} />, {props.post.created.toLocaleString()}, <Link to={'/post/' + props.post.id}>{props.post.comments} комментариев</Link>{props.post.newComments ? <>, <Link to={'/post/' + props.post.id + '?new'}>{props.post.newComments} новых</Link></> : ''}
                </div>
            </div>
        </div>
    )
}
