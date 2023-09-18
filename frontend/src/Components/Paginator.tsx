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
    const {page, base, queryStringParams, pages} = props;

    const range = 7;

    if (pages <= 1) {
        return null;
    }

    let pageMin = Math.max(1, page - Math.floor(range / 2));
    let pageMax = Math.min(page + Math.floor(range / 2 - (range + 1) % 2), pages);
    if (pageMax - pageMin + 1 < range) {
        if (pageMin === 1) {
            pageMax = Math.min(range, pages);
        } else {
            pageMin = Math.max(pageMax - range + 1, 1);
        }
    }

    const commonProps = {base, params: queryStringParams || {}, currentPage: page};

    const links = [];
    links.push(<Page key={-2} disabled={page === 1} page={1} {...commonProps}>⇤</Page>);
    links.push(<Page key={-1} disabled={page === 1} page={page-1} {...commonProps}>←</Page>);

    if (pageMin > 1) {
        links.push(<span key='el1' className={styles.ellipsis}>…</span>);
    }

    for (let i = pageMin; i <= pageMax; i++) {
        links.push(<Page key={i} disabled={i === page}  current={i === page} page={i} {...commonProps}>{i}</Page>);
    }

    if (pageMax < pages) {
        links.push(<span key='el2' className={styles.ellipsis}>…</span>);
    }

    links.push(<Page key={pages + 1} disabled={page === pages} page={page+1} {...commonProps}>→</Page>);
    links.push(<Page key={pages + 2} disabled={page === pages} page={pages} {...commonProps}>⇥</Page>);

    return (
      <div className={styles.paginator}>{links}</div>
    );
}

interface PageProps {
    disabled?: boolean;
    children: React.ReactNode;
    base: string;
    params: Record<string, string>;
    page: number;
    current?: boolean;
}

function Page(props: PageProps) {
    const {disabled, children, base, params, page, current} = props;
    const search = new URLSearchParams(params);
    if (page !== 1) {
        search.set('page', page.toString());
    }
    return <Link className={classNames(styles.page, {[styles.disabled]: disabled, [styles.current]: current})}
                 to={{pathname: base, search: search.toString()}}>{children}</Link>;
}