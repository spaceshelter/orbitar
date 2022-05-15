import {Link} from 'react-router-dom';
import React from 'react';
import styles from './Paginator.module.css';

interface PaginatorProps {
    page: number;
    pages: number;
    base: string;
}

export default function Paginator(props: PaginatorProps) {
    const pages = [];
    for (let i = 1; i <= props.pages; i++) {
        const classes = [styles.page];
        if (i === props.page) {
            classes.push(styles.current);
        }
        let search = '';
        if (i > 1) {
            search = 'page=' + i;
        }

        pages.push(<Link key={i} className={classes.join(' ')} to={{pathname: props.base, search}}>{i}</Link>);
    }

    return (
        <div className={styles.paginator}>
            {pages}
        </div>
    );
}