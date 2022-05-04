import React from 'react';
import { Link } from "react-router-dom";
import {useSiteName} from '../AppState/AppState';
import {PostInfo} from '../Types/PostInfo';

interface PostLinkProps extends React.ComponentPropsWithRef<"a"> {
    post: PostInfo;
    children: React.ReactNode;
    onlyNew?: boolean;
}

export default function PostLink(props: PostLinkProps) {
    let {siteName, fullSiteName} = useSiteName();
    let { fullSiteName: fullPostSiteName } = useSiteName(props.post.site);
    let { fullSiteName: fullMainSiteName } = useSiteName(props.post.site);

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

    return (
        <Link to={link} className={props.className}>{props.children}</Link>
    )
}