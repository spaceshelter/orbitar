import styles from './PostComponent.module.scss';
import RatingSwitch from './RatingSwitch';
import Username from './Username';
import React, {useMemo, useState} from 'react';
import {PostInfo} from '../Types/PostInfo';
import {Link} from 'react-router-dom';
import DateComponent from './DateComponent';
import ContentComponent from './ContentComponent';
import {ReactComponent as CommentsIcon} from '../Assets/comments.svg';
import {ReactComponent as OptionsIcon} from '../Assets/options.svg';
import {ReactComponent as WatchIcon} from '../Assets/watch.svg';
import {ReactComponent as UnwatchIcon} from '../Assets/unwatch.svg';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';

import PostLink from './PostLink';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import CreateCommentComponent from './CreateCommentComponent';

interface PostComponentProps {
    post: PostInfo;
    showSite?: boolean;
    buttons?: React.ReactNode;
    onChange?: (id: number, post: Partial<PostInfo>) => void;
    autoCut?: boolean;
    onEdit?: (text: string, post: PostInfo) => Promise<PostInfo | undefined>;
}

export default function PostComponent(props: PostComponentProps) {
    const api = useAPI();
    const [showOptions, setShowOptions] = useState(false);
    const [editingText, setEditingText] = useState<false | string>(false);

    const handleVote = useMemo(() => {
        return (value: number, vote?: number) => {
            props.post.rating = value;
            props.post.vote = vote;

            if (props.onChange) {
                props.onChange(props.post.id, {
                    rating: value,
                    vote
                });
            }
        };
    }, [props.post]);

    const { id, created, site, author, title, content, vote, rating, watch } = props.post;

    const toggleOptions = () => {
        setShowOptions(!showOptions);
    };
    const toggleWatch = () => {
        const oldState = !!props.post.watch;
        const newState = !oldState;
        props.post.watch = newState;

        api.post.watch(id, newState)
            .then(({watch}) => {
                if (props.onChange) {
                    props.onChange(props.post.id, {watch});
                }
            })
            .catch(() => {
                props.post.watch = oldState;
                toast.error('Непонятно, слежу или нет?');
            });

        setShowOptions(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleBookmark = () => {
        const oldState = !!props.post.bookmark;
        const newState = !oldState;
        props.post.bookmark = newState;

        api.post.bookmark(id, newState)
            .then(({bookmark}) => {
                if (props.onChange) {
                    props.onChange(props.post.id, {bookmark});
                }
            })
            .catch(() => {
                props.post.bookmark = oldState;
                toast.error('Кладмен мудак - закладка не найдена');
            });
    };

    const handleEditComplete = async (text: string) => {
        try {
            await props.onEdit?.(text, props.post);
            setEditingText(false);
            // return res;
            return undefined;
        }
        catch (err) {
            console.log('Could not edit post', err);
            toast.error('Не удалось отредактировать пост');
            throw err;
        }
    };

    const handleEdit = async () => {
        try {
            const post = await api.postAPI.get(props.post.id, 'source', true);
            setEditingText(post.post.content);
        }
        catch (e) {
            console.log('Get comment error:', e);
            toast.error('Не удалось включить редактирование');
        }
    };

    return (
        <div className={styles.post}>
            <div className={styles.header}>
                <div className={styles.signature}>
                    {props.showSite ? <><Link to={`//${site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{site}</Link> • </> : ''}
                    <Username className={styles.username} user={author} /> • <PostLink post={props.post}><DateComponent date={created} /></PostLink>
                    {props.post.editFlag && <> • изменён</>}
                </div>
                <div className={styles.contentContainer}>
                    {title && <div className={styles.title}><PostLink post={props.post}>{title}</PostLink></div>}
                    {editingText === false ?
                        <div className={styles.content}>
                            <ContentComponent className={styles.content} content={content} autoCut={props.autoCut} />
                        </div>
                        :
                        <CreateCommentComponent open={true} text={editingText} onAnswer={handleEditComplete} />
                    }
                </div>
            </div>
            <div className={styles.controls}>
                <div className={styles.control}>
                    <RatingSwitch type='post' id={id} rating={{ vote, value: rating }} onVote={handleVote} />
                </div>
                <div className={styles.control}><CommentsCount post={props.post} /></div>
                {/*<div className={styles.control}><button disabled={true} onClick={toggleBookmark} className={bookmark ? styles.active : ''}><BookmarkIcon /><span className={styles.label}></span></button></div>*/}
                {props.post.canEdit && props.onEdit && <div className={styles.control}><button onClick={handleEdit}><EditIcon /></button></div>}
                <div className={styles.control + ' ' + styles.options}>
                    <button onClick={toggleOptions} className={showOptions ? styles.active : ''}><OptionsIcon /></button>
                    {showOptions &&
                        <div className={styles.optionsList}>
                            <div><button className={styles.control} onClick={toggleWatch}>{watch ?<><UnwatchIcon /><div className={styles.label}>не отслеживать</div></> : <><WatchIcon /><div className={styles.label}>отслеживать</div></>}</button></div>
                        </div>
                    }
                </div>
            </div>
            {props.buttons}
        </div>
    );
}

function CommentsCount(props: {post: PostInfo}) {
    const {comments, newComments} = props.post;

    if (!comments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={[styles.label, styles.noComments].join(' ') }>Комментировать</span></PostLink>;
    }

    if (!newComments) {
        return <PostLink post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    if (newComments === comments) {
        return <PostLink className={styles.active} post={props.post}><CommentsIcon /><span className={styles.label}>{comments}</span></PostLink>;
    }

    return <><PostLink className={styles.active} post={props.post} onlyNew={true}><CommentsIcon /><span className={styles.label}>{newComments}</span></PostLink> / <PostLink post={props.post}>{comments}</PostLink></>;
}
