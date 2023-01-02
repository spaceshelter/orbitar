import {Link} from 'react-router-dom';
import React from 'react';
import styles from './Paginator.module.scss';

interface PaginatorProps {
    page: number;
    pages: number;
    base: string;
    queryStringParams?: Record<string, string>;
}

interface RangedPaginatorProps {
    start: number;
    end: number;
    setRange: (range: [number, number]) => void;
}

interface PageProps {
    page: number;
    current: boolean;
    base: string;
    queryStringParams?: Record<string, string>;
}

function Page(props: PageProps) {
    const classes = [styles.page];
    if (props.current) {
        classes.push(styles.current);
    }
    const params = new URLSearchParams(props.queryStringParams || {});
    if (props.page > 1 || (params && Object.keys(params).length)) {
        params.set('page', props.page.toString());
    }
    const search = params.toString();

    return <Link className={classes.join(' ')} to={{pathname: props.base, search}}>{props.page}</Link>;
}

/**
 * Shows first 5 pages, then 5 pages centered around the current page, then the last 5 pages.
 * For the ranges of pages that are not centered around the current page, shows a "..." (RangedPaginator).
 *
 * Page: <Link key={i} className={classes.join(' ')} to={{pathname: props.base, search}}>{i}</Link>
 * <div className={styles.paginator}>
 *     {pages}
 * </div>
 */
export default function Paginator(props: PaginatorProps) {
    // range, currently selected by user
    const [range, setRange] = React.useState<[number, number] | undefined>();

    // insert all intervals into a list and then merge them
    const intervals: [number, number][] = [];
    intervals.push([1, Math.min(5, props.pages)]);
    intervals.push([Math.max(1, props.page - 2), Math.min(props.pages, props.page + 2)]);
    intervals.push([Math.max(1, props.pages - 4), props.pages]);
    if (range) {
        // split range in to 8 intervals. Add boundaries as the individual pages.
        if (range[1] - range[0] > 8) {
            for (let i = 0; i < 8; i++) {
                const j = range[0] + Math.floor(i * ((range[1] - range[0]) / 8));
                intervals.push([j, j]);
            }
        } else {
            intervals.push([...range]);
        }
    }
    console.log(intervals.map(_ => _.toString()));
    dedupIntervals(intervals);
    console.log(intervals.map(_ => _.toString()));

    const gaps = findMissing(intervals);

    const result: [number, number, boolean][] = [];
    intervals.forEach(it => result.push([it[0], it[1], false]));
    gaps.forEach(it => result.push([it[0], it[1], true]));
    result.sort((a, b) => a[0] - b[0]);

    const renderRange = (start: number, end: number) => {
        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(<Page key={i} page={i} current={i === props.page} base={props.base} queryStringParams={props.queryStringParams}/>);
        }
        return pages;
    };

    const pages = result.flatMap(([b, e, isGap]) => {
        if (isGap && e - b > 8) {
            return [<RangedPaginator key={b + '-' + e} start={b} end={e} setRange={setRange}/>];
        } else {
            return renderRange(b, e);
        }
    });

    return <div className={styles.paginator}>{pages}</div>;
}

/**
 * Make sure that intervals do not overlap and are sorted.
 * Changes the intervals in place.
 */
function dedupIntervals(intervals: [number, number][]) {
    // sort intervals by start and then by end
    intervals.sort((a, b) => a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);
    let newL = 0;

    for (let i = 0; i < intervals.length; i++) {
        const last = newL === 0 ? undefined : intervals[newL - 1];
        if (last && last[1] >= intervals[i][0]) {
            if (last[1] < intervals[i][1]) {
                intervals[newL++] = [last[1] + 1, intervals[i][1]];
            }
        } else {
            intervals[newL++] = intervals[i];
        }
    }
    intervals.length = newL;
}

/**
 * Find gaps between intervals and return them as intervals.
 */
function findMissing(intervals: [number, number][]) {
    const newIntervals: [number, number][] = [];
    for (let i = 0; i < intervals.length - 1; i++) {
        if (intervals[i][1] + 1 < intervals[i + 1][0]) {
            newIntervals.push([intervals[i][1] + 1, intervals[i + 1][0] - 1]);
        }
    }
    return newIntervals;
}

/**
 * Shows a range of pages as "...", when clicked, sets the range to the given range.
 */
function RangedPaginator(props: RangedPaginatorProps) {
    return (
        <span className={styles.page} onClick={() => props.setRange([props.start, props.end])}>...</span>
    );
}