import React from 'react';
// import styles from './MyThings.module.css';
import {
    Link,
    MakeGenerics,
    Outlet,
    ReactLocation,
    Router,
    useMatch,
} from "react-location";

interface MyThingsProps {
    posts: number;
    comments: number;
}

export default function MyThings(props: MyThingsProps) {
    return (
        <Link to="/my">{props.posts}/{props.comments}</Link>
    )
}
