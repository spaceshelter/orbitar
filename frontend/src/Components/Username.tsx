import React from 'react';
import styles from './Username.module.css';
import { Link } from 'react-router-dom';

interface UsernameProps extends React.ComponentPropsWithRef<'a'> {
    user: {
        username: string;
    };
}

export default function Username(props: UsernameProps) {
    return (
        <Link to={'/user/' + props.user.username} className={styles.username + (props.className ? ' ' + props.className : '')}>{props.user.username}</Link>
    );
}