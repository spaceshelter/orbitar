import {Link} from 'react-router-dom';
import React from 'react';
import styles from './Paginator.module.scss';
import classNames from 'classnames';

interface PaginatorProps {
    page: number;
    pages: number;
    base: string;
    queryStringParams?: Record<string, string>;
}

export default function Paginator(props: PaginatorProps) {
    const {page, base, queryStringParams} = props;
    let {pages} = props;

    const range = 5;
    const links = [];

    const rangeMin = (range % 2 === 0) ? (range / 2) - 1 : (range - 1) / 2;
    const rangeMax = (range % 2 === 0) ? rangeMin + 1 : rangeMin;
    let pageMin = page - rangeMin;
    let pageMax = page + rangeMax;

    const params = new URLSearchParams(queryStringParams || {});
    let search = params.toString();

    pageMin = (pageMin < 1) ? 1 : pageMin;
    pageMax = (pageMax < (pageMin + range - 1)) ? pageMin + range - 1 : pageMax;
    if (pageMax > pages) {
        pageMin = (pageMin > 1) ? pages - range + 1 : 1;
        pageMax = pages;
    }

    pageMin = (pageMin < 1) ? 1 : pageMin;

    if (isNaN(pageMin))
        pageMin = 0;
    if (isNaN(pages))
        pages = 0;
    if (isNaN(pageMax))
        pageMax = 0;

    links.push(<Link key={-2} className={classNames(styles.page, styles.control, {[styles.disabled]: page === 1})} to={{pathname: base, search}}>⇤</Link>);

    if (page - 1 !== 1) {
        params.set('page', (page - 1).toString());
    }
    search = params.toString();
    links.push(<Link key={-1} className={classNames(styles.page, styles.control, {[styles.disabled]: page === 1})} to={{pathname: base, search}}>←</Link>);

    for (let i = pageMin; i <= pageMax; i++) {
        params.set('page', i.toString());
        search = params.toString();
        links.push(<Link key={i} className={classNames(styles.page, {[styles.disabled]: i === page, [styles.current]: i === page})} to={{pathname: base, search}}>{i}</Link>);
    }

    if (page + 1 !== pages) {
        params.set('page', (page + 1).toString());
    }
    search = params.toString();
    links.push(<Link key={pages + 1} className={classNames(styles.page, styles.control, {[styles.disabled]: page === pages})} to={{pathname: base, search}}>→</Link>);

    params.set('page', pages.toString());
    search = params.toString();
    links.push(<Link key={pages + 2} className={classNames(styles.page, styles.control, {[styles.disabled]: page === pages})} to={{pathname: base, search}}>⇥</Link>);

    return (
      <div className={styles.paginator}>{links}</div>
    );
}
