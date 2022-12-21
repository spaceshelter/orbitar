import styles from './SignatureComponent.module.scss';
import {Link} from 'react-router-dom';
import Username from './Username';
import PostLink from './PostLink';
import DateComponent from './DateComponent';
import React from 'react';
import {UserBaseInfo} from '../Types/UserInfo';
import {EditFlag} from '../API/PostAPI';
import {PostLinkInfo} from '../Types/PostInfo';

interface SignatureComponentProps {
    showSite?: boolean;
    site?: string;
    author: UserBaseInfo;
    editFlag?: EditFlag;
    onHistoryClick: () => void;
    postLink: PostLinkInfo;
    postLinkIsNew?: boolean
    parentCommentId?: number;
    parentCommentAuthor?: string;
    date: Date;
    commentId?: number;
}

export const SignatureComponent = (props: SignatureComponentProps) => {
    return (
        <div className={styles.signature}>
            {(props.showSite && props.site && props.site !== 'main') ? <><Link to={`/s/${props.site}`}>{props.site}</Link> • </> : ''}
            <Username className={styles.username} user={props.author} /> • <PostLink post={props.postLink} commentId={props.commentId}><DateComponent date={props.date} /></PostLink>
            {!!(props.parentCommentId) && <> • <PostLink className={'arrow i i-arrow'} post={props.postLink} onlyNew={props.postLinkIsNew} commentId={props.parentCommentId}> {props.parentCommentAuthor}</PostLink></>}
            {props.editFlag && <> • <button className={styles.toggleHistory} onClick={props.onHistoryClick}>изменён</button></>}
        </div>
    );
};
