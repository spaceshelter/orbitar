import {SiteInfo} from '../Types/SiteInfo';
import styles from './SiteSidebar.module.css';
import {Link} from 'react-location';
import React from 'react';

interface SiteSidebarProps {
    site: SiteInfo;
}

export default function SiteSidebar(props: SiteSidebarProps) {
    return (<div className={styles.container}>
        <div className={styles.fixed}>
            <Link className={styles.siteName} to={'/'}> {props.site.name}</Link>
            <Link className={styles.newPost} to={'/create'}>Новый пост</Link>
            <div className={styles.podsites}>
                {props.site.site !== 'main' && <div><a href="https://orbitar.space/">Главная</a></div>}
                {props.site.site !== 'idiod' && <div><a href="https://idiod.orbitar.space/">idiod</a></div>}
                {props.site.site !== 'dev' && <div><a href="https://dev.orbitar.space/">Баги и фичи</a></div>}
            </div>
        </div>
    </div>)
}
