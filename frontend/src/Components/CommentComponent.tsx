import {CommentInfo, PostLinkInfo} from '../Types/PostInfo';
import styles from './CommentComponent.module.scss';
import RatingSwitch from './RatingSwitch';
import React, {useMemo, useState} from 'react';
import {CreateCommentComponentRestricted} from './CreateCommentComponent';
import ContentComponent from './ContentComponent';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {SignatureComponent} from './SignatureComponent';
import {HistoryComponent} from './HistoryComponent';
import Conf from '../Conf';

interface CommentProps {
    comment: CommentInfo;
    showSite?: boolean;
    parent?: CommentInfo;
    onAnswer?: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
    onEdit?: (text: string, comment: CommentInfo) => Promise<CommentInfo | undefined>;
    depth?: number
    maxTreeDepth?: number
}

export default function CommentComponent(props: CommentProps) {
    const [answerOpen, setAnswerOpen] = useState(false);
    const [editingText, setEditingText] = useState<false | string>(false);
    const [showHistory, setShowHistory] = useState(false);
    const api = useAPI();

    const handleAnswerSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setAnswerOpen(!answerOpen);
    };

    const handleAnswer = async (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
        if (!post) {
            return undefined;
        }
        const res = await props.onAnswer?.(text, post, comment);
        setAnswerOpen(false);
        return res;
    };

    const handleEditComplete = async (text: string) => {
        try {
            const res = await props.onEdit?.(text, props.comment);
            setEditingText(false);
            return res;
        }
        catch (err) {
            console.log('Could not edit comment', err);
            toast.error('Не удалось отредактировать комментарий');
            throw err;
        }
    };

    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            props.comment.rating = value;
            props.comment.vote = vote;
        };
    }, [props.comment]);

    const handleEdit = async () => {
        try {
            const comment = await api.postAPI.getComment(props.comment.id, 'source');
            setEditingText(comment.comment.content);
        }
        catch (e) {
            console.log('Get comment error:', e);
            toast.error('Не удалось включить редактирование');
        }
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    const {author, created, site, postLink, editFlag, content} = props.comment;
    const depth = props.depth || 0;
    const maxDepth = props.maxTreeDepth || 0;
    const isFlat = depth > maxDepth;
    return (
        <div className={styles.comment + (props.comment.isNew ? ' isNew': '') + (isFlat?' isFlat':'')} data-comment-id={props.comment.id}>
            <div className='commentBody'>
                <SignatureComponent showSite={props.showSite} site={site} author={author} onHistoryClick={toggleHistory} parentCommentId={props.parent?.id} parentCommentAuthor={props.parent?.author?.username} postLink={postLink} commentId={props.comment.id} date={created} editFlag={editFlag} />
                {editingText === false ?
                    (showHistory
                        ?
                            <HistoryComponent initial={{ content, date: created }} history={{ id: props.comment.id, type: 'comment' }} onClose={toggleHistory} />
                        :
                            <div className={styles.content}>
                                <ContentComponent className={styles.commentContent} content={content} lowRating={props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD} autoCut={props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD} />
                            </div>
                    )
                :
                    <CreateCommentComponentRestricted open={true} text={editingText} onAnswer={handleEditComplete} />
                }

                <div className={styles.controls}>
                    <div className={styles.control}>
                        <RatingSwitch type="comment" id={props.comment.id} rating={{ vote: props.comment.vote, value: props.comment.rating }} onVote={handleVote} />
                    </div>
                    {props.comment.canEdit && props.onEdit && <div className={styles.control}><button onClick={handleEdit} className='i i-edit' /></div>}
                    {props.onAnswer && <div className={styles.control}><button onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</button></div>}
                </div>
            </div>
            {(props.comment.answers || answerOpen) ?
                <div className={styles.answers + (isFlat?' isFlat':'')}>
                    {props.onAnswer && <CreateCommentComponentRestricted open={answerOpen} post={props.comment.postLink} comment={props.comment} onAnswer={handleAnswer} />}
                    {props.comment.answers && props.onAnswer ? props.comment.answers.map(comment =>
                        <CommentComponent maxTreeDepth={maxDepth} depth={depth+1} parent={props.comment} key={comment.id} comment={comment} onAnswer={props.onAnswer} onEdit={props.onEdit} />) : <></>}
                </div>
                : <></>}

        </div>
    );
}

