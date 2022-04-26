import styles from './PostComponent.module.css';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React, {useEffect, useRef} from 'react';
import {PostInfo} from '../Types/PostInfo';
import {UserGender} from '../Types/UserInfo';
import {Link} from "react-location";
import {pluralize} from '../Utils/utils';
import DateComponent from './DateComponent';

interface PostComponentProps {
    post: PostInfo;
    buttons?: React.ReactNode;
}

export default function PostComponent(props: PostComponentProps) {
    const contentDiv = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let content = contentDiv.current;
        if (!content) {
            return;
        }

        content.querySelectorAll('img').forEach(img => {
            console.log('IMG', img, img.width, img.height);
            img.onload = () => {
                let el: HTMLElement | null = img;
                while (el) {
                    if (el.tagName.toUpperCase() === 'A') {
                        return;
                    }
                    el = el.parentElement;
                }

                let imageLarge = false;
                img.classList.add('image-scalable');
                if (img.naturalWidth > 500 || img.naturalHeight > 500) {
                    img.onclick = () => {
                        if (imageLarge) {
                            imageLarge = false;
                            img.classList.remove('image-preview');
                            return;
                        }
                        imageLarge = true;
                        img.classList.add('image-preview');
                    }
                }
            };
        });
    }, [contentDiv]);

    return (
        <div className={styles.post}>
            <div className={styles.header}>
                <div className={styles.contentContainer}>
                    {props.post.title && <div className={styles.title}>
                        {props.post.title}
                    </div>}
                    <div className={styles.content} dangerouslySetInnerHTML={{__html: props.post.content}} ref={contentDiv}>
                    </div>

                </div>
            </div>
            <div className={styles.controls}>
                <RatingSwitch type='post' id={props.post.id} rating={{ vote: props.post.vote, value: props.post.rating }} />
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
    let text = pluralize(props.count, ['новый', 'новых', 'новых']);
    if (props.bold) {
        return <b>{text}</b>
    }
    else {
        return <>{text}</>
    }
}