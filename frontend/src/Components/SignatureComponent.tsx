import styles from './SignatureComponent.module.scss';
import {Link} from 'react-router-dom';
import Username from './Username';
import PostLink from './PostLink';
import DateComponent from './DateComponent';
import React from 'react';
import {UserInfo} from '../Types/UserInfo';
import {EditFlag} from '../API/PostAPI';
import {PostLinkInfo} from '../Types/PostInfo';

interface SignatureComponentProps {
    showSite?: boolean;
    site?: string;
    author: UserInfo;
    editFlag?: EditFlag;
    onHistoryClick: () => void;
    postLink: PostLinkInfo;
    parentCommentId?: number;
    date: Date;
    commentId?: number;
}

export const SignatureComponent = (props: SignatureComponentProps) => {
    return (
        <div className={styles.signature}>
            {(props.showSite && props.site) ? <><Link to={`//${props.site}.${process.env.REACT_APP_ROOT_DOMAIN}/`}>{props.site}</Link> • </> : ''}
            <Username className={styles.username} user={props.author} /> • <PostLink post={props.postLink} commentId={props.commentId}><DateComponent date={props.date} /></PostLink>
            {props.parentCommentId && <> • <PostLink className={'arrow'} post={props.postLink} commentId={props.parentCommentId}>🡬</PostLink></>}
            {props.editFlag && <> • <button className={styles.toggleHistory} onClick={props.onHistoryClick}>изменён</button></>}
        </div>
    );
};
