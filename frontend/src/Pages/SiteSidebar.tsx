import {SiteInfo} from '../Types/SiteInfo';
import styles from './SiteSidebar.module.css';
import {Link} from 'react-location';
import React from 'react';

interface SiteSidebarProps {
    site: SiteInfo;
}

export default function SiteSidebar(props: SiteSidebarProps) {
    return (<div className={styles.site}>
        <Link className={styles.siteName} to={'/'}> {props.site.name}</Link>
        <Link className={styles.newPost} to={'/create'}>Новый пост</Link>
    </div>)
}
