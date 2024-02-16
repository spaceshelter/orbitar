import React from 'react';
import styles from './Username.module.scss';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

import { draw, rand31 } from 'orbitar-bob';

interface UsernameProps extends React.ComponentPropsWithRef<'a'> {
    user: {
        username: string;
    };
    inactive?: boolean;
}

export default function Username(props: UsernameProps) {
    // const bob = 'http://api.orbitar.local/api/v1/bob/';
    // <img src={bob+props.user.username}/>{props.user.username}
    const data = draw(1, rand31());
    return (
        <Link to={'/u/' + props.user.username} className={classNames(styles.username,
            props.inactive && styles.inactive, props.className)}>
            <img src={data}/> {props.user.username}
        </Link>
    );
}
