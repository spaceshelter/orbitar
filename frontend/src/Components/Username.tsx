import React from 'react';
import styles from './Username.module.css';
import {
    Link
} from "react-location";
import {UserInfo} from '../Types/UserInfo';

interface UsernameProps {
    user: UserInfo;
}

export default function Username(props: UsernameProps) {
    return (
        <Link to={"/user/" + props.user.username}  className={styles.username}>{props.user.username}</Link>
    )
}