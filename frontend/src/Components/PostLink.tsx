import React from 'react';
import {Link} from 'react-router-dom';
import {useSiteName} from '../AppState/AppState';
import {PostLinkInfo} from '../Types/PostInfo';

interface PostLinkProps extends React.ComponentPropsWithRef<'a'> {
    post: PostLinkInfo;
    commentId?: number;
    children?: React.ReactNode;
    onlyNew?: boolean;
}

export default function PostLink(props: PostLinkProps) {
    const {siteName} = useSiteName();
    const { fullSiteName: fullPostSiteName } = useSiteName(props.post.site);
    const { fullSiteName: fullMainSiteName } = useSiteName(props.post.site);

    // case 1: same site => /post/:id
    // case 2: on sub, link to main => //<host>/post/:id
    // case 3, fallback: on main, link to sub => //<sub>.<host>/post/:id

    let link = '/post/' + props.post.id;
    if (siteName === props.post.site) {
        // do nothing
    }
    else if (siteName !== 'main' && props.post.site === 'main') {
        link = '//' + fullMainSiteName + link;
    }
    else {
        link = '//' + fullPostSiteName + link;
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