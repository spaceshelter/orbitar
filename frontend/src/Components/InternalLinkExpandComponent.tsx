import React, { useEffect, useState } from 'react';
import {CommentInfo, PostInfo} from '../Types/PostInfo';
import CommentComponent from './CommentComponent';
import PostComponent from './PostComponent';
import {useAPI} from '../AppState/AppState';
import style from './InternalLinkExpandComponent.module.scss';
import classNames from 'classnames';

interface InternalLinkExpandComponentProps {
    postId: number;
    commentId?: number;
    onClose: () => void;
}

type State = null | {
    type: 'post',
    post: PostInfo
} | {
    type: 'comment',
    comment: CommentInfo
};

/**
 * Component used to fetch and display either a post or a comment inline based on the provided
 * postId and commentId props.
 */
const InternalLinkExpandComponent: React.FC<InternalLinkExpandComponentProps> = ({
        postId, commentId
    }) => {
    const [data, setData] = useState<State>(null);
    const api = useAPI();

    useEffect(() => {
        if (commentId) {
            api.post.getComment(commentId).then((comment) => {
                setData({type: 'comment', comment});
            });
        } else {
            api.post.get(postId).then((post) => {
                setData({type: 'post', post: post.post});
            });
        }
    }, [postId, commentId]);

    const render = () => {
        if (!data) {
            return <div>Загружаем...</div>;
        } else if (data.type === 'comment') {
            return <CommentComponent comment={data.comment} hideRating={true}/>;
        } else {
            return <PostComponent post={data.post} hideRating={true}/>;
        }
    };

    return <div className={classNames(style.internalLinkExpand, 'internalLinkExpand')}>{render()}</div>;
};

export default InternalLinkExpandComponent;