import React from 'react';
import {Link} from 'react-router-dom';
import {PostLinkInfo} from '../Types/PostInfo';

interface PostLinkProps extends React.ComponentPropsWithRef<'a'> {
    post: PostLinkInfo;
    commentId?: number;
    children: React.ReactNode;
    onlyNew?: boolean;
}

export default function PostLink(props: PostLinkProps) {
    let link = `/p${props.post.id}`;
    if (props.post.site !== 'main') {
        link = `/s/${props.post.site}/p${props.post.id}`;
    }

    if (props.onlyNew) {
        link += '?new';
    }

    if (props.commentId) {
        link += '#' + props.commentId;
    }

    return (
        <Link to={link} className={props.className} onClick={props.onClick}>{props.children}</Link>
    );
}