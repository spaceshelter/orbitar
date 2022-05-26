import React from 'react';
import styles from './Username.module.css';
import { Link } from 'react-router-dom';
import classNames from 'classnames';

interface UsernameProps extends React.ComponentPropsWithRef<'a'> {
    user: {
        username: string;
    };
}

export default function Username(props: UsernameProps) {
    return (
        <Link to={'/u/' + props.user.username} className={classNames('i i-user', styles.username, props.className)}>{props.user.username}</Link>
    );
}
