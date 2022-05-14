import React, {useEffect} from 'react';
import {useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import {ThemePreview} from "../Components/ThemePreview";

export default function ThemePreviewPage() {
    let siteName = 'main';
    if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
        siteName = window.location.hostname.split('.')[0];
    }

    const { site } = useAppState();

    useEffect(() => {
        document.title = 'Тема';
    }, [site]);

    return (
        <div className={styles.container}>
            <ThemePreview />
        </div>
    );
}


