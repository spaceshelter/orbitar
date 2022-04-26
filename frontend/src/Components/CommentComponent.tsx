import {CommentInfo, PostInfo} from '../Types/PostInfo';
import styles from './CommentComponent.module.css';
import RatingSwitch from './RatingSwitch';
import {UserGender} from '../Types/UserInfo';
import Username from './Username';
import {Link} from 'react-location';
import React, {useEffect, useRef, useState} from 'react';
import CreateCommentComponent from './CreateCommentComponent';
import DateComponent from './DateComponent';

interface CommentProps {
    post: PostInfo;
    comment: CommentInfo;

    onAnswer: (text: string, post: PostInfo, comment?: CommentInfo) => Promise<CommentInfo>;
}

export default function CommentComponent(props: CommentProps) {
    const [answerOpen, setAnswerOpen] = useState(false);
    const contentDiv = useRef<HTMLDivElement>(null);

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
        <div className={styles.container}>
            <div className={styles.comment + (props.comment.isNew ? ' ' + styles.isNew : '')}>
                <div className={styles.commentContent} dangerouslySetInnerHTML={{__html: props.comment.content}} ref={contentDiv}/>
                <div className={styles.controls}>
                    <RatingSwitch type="comment" id={props.comment.id} rating={{ vote: props.comment.vote, value: props.comment.rating }} />
                    <div className={styles.signature}>
                        {props.comment.author.gender === UserGender.she ? 'Написала' : 'Написал'} <Username user={props.comment.author} />, <DateComponent date={props.comment.created} />, <Link to={'/post/' + props.post.id + '#' + props.comment.id } onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</Link>
                    </div>
                </div>
            </div>
            <CreateCommentComponent open={answerOpen} comment={props.comment} post={props.post} onAnswer={handleAnswer} />
            {props.comment.answers ?
                <div className={styles.answers}>
                    {props.comment.answers.map(comment => <CommentComponent key={comment.id} comment={comment} post={props.post} onAnswer={props.onAnswer} />)}
                </div>
            : <></>}
        </div>
    )
}

