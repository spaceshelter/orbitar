import {CommentInfo, PostLinkInfo} from '../Types/PostInfo';
import styles from './CommentComponent.module.scss';
import RatingSwitch from './RatingSwitch';
import React, {useMemo, useState} from 'react';
import CreateCommentComponent from './CreateCommentComponent';
import ContentComponent from './ContentComponent';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {SignatureComponent} from './SignatureComponent';
import {HistoryComponent} from './HistoryComponent';
import {computed} from 'mobx';
import {Observer} from 'mobx-react-lite';
import classNames from 'classnames';

interface CommentProps {
    comment: CommentInfo;
    showSite?: boolean;
    parent?: CommentInfo;
    onAnswer?: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>;
    onEdit?: (text: string, comment: CommentInfo) => Promise<CommentInfo | undefined>;
    depth?: number
    maxTreeDepth?: number

    collapsedIds?: Set<number>;
    unfocus?: () => void;
    focus?: (childId: number, collapsedIds: number []) => void;
    childIdx?: number;
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

    const handleFocus = (childId: number, toCollapse: number[]) => {
        if (!props.comment.answers || !props.focus) {
            return;
        }

        for (const child of props.comment.answers) {
            if (child.id === childId) {
                break;
            }
            toCollapse.push(child.id);
        }
        props.focus(props.comment.id, toCollapse);
    };

    const collapsed = useMemo(() => {
        return computed(() => {
            return props.collapsedIds && props.collapsedIds.has(props.comment.id);
        });
    }, [props.collapsedIds]);

    const collapsedChildren = useMemo(() => {
        return computed(() => {
            return props.collapsedIds && props.comment.answers && props.comment.answers.some(child => props.collapsedIds!.has(child.id));
        });
    }, [props.collapsedIds]);

    const {author, created, site, postLink, editFlag, content} = props.comment;
    const depth = props.depth || 0;
    const maxDepth = props.maxTreeDepth || 0;
    const isFlat = depth > maxDepth;

    return (
        <Observer>{() =>
        <div className={
            classNames(styles.comment, {
            [styles.collapsed]: collapsed.get(),
            'isNew': props.comment.isNew,
            'isFlat': isFlat,
        })
        } data-comment-id={props.comment.id}>
            <div className={classNames('commentBody', {'collapsedChildren' : collapsedChildren.get() })}>
                <SignatureComponent showSite={props.showSite} site={site} author={author} onHistoryClick={toggleHistory}
                                    parentCommentId={props.childIdx && props.parent?.id} postLink={postLink} commentId={props.comment.id} date={created} editFlag={editFlag}
                                    handleFocus={() => props.focus?.(props.comment.id, [])}
                />
                {editingText === false ?
                    (showHistory
                        ?
                            <HistoryComponent initial={{ content, date: created }} history={{ id: props.comment.id, type: 'comment' }} onClose={toggleHistory} />
                        :
                            <div className={styles.content}>
                                <ContentComponent className={styles.commentContent} content={content} />
                            </div>
                    )
                :
                    <CreateCommentComponent open={true} text={editingText} onAnswer={handleEditComplete} />
                }

                <div className={styles.controls}>
                    <div className={styles.control}>
                        <RatingSwitch type="comment" id={props.comment.id} rating={{ vote: props.comment.vote, value: props.comment.rating }} onVote={handleVote} />
                    </div>
                    {props.comment.canEdit && props.onEdit && <div className={styles.control}><button onClick={handleEdit} className='i i-edit' /></div>}
                    {props.onAnswer && <div className={styles.control}><button onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</button></div>}
                </div>
            </div>
            {collapsedChildren.get() && <div className={styles.collapsedInfo} onClick={props.unfocus}>
                Комментарии скрыты...
            </div>}

            {(props.comment.answers || answerOpen) ?
                <div className={styles.answers + (isFlat?' isFlat':'')}>
                    {props.onAnswer && <CreateCommentComponent open={answerOpen} post={props.comment.postLink} comment={props.comment} onAnswer={handleAnswer} />}
                    {props.comment.answers && props.onAnswer ? props.comment.answers.map((comment, idx) =>
                        <CommentComponent maxTreeDepth={maxDepth} depth={depth+1} parent={props.comment} key={comment.id} comment={comment}
                                          onAnswer={props.onAnswer} onEdit={props.onEdit}
                                          focus={handleFocus} unfocus={props.unfocus} collapsedIds={props.collapsedIds} childIdx={idx}/>) : <></>}
                </div>
                : <></>}

        </div>
        }</Observer>
    );
}

