import {Link} from 'react-router-dom';
import React from 'react';
import styles from './Paginator.module.css';
import {observer} from 'mobx-react-lite';

interface PaginatorProps {
    page: number;
    pages: number;
    base: string;
}

const Paginator = observer((props: PaginatorProps) => {
    const pages = [];
    for (let i = 1; i <= Math.min(props.pages, 100); i++) {
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

    if (props.pages > 100) {
        pages.push(<span key={props.pages} className={styles.page}>...</span>);
    }

    return (
        <div className={styles.paginator}>
            {pages}
        </div>
    );
});

export default Paginator;