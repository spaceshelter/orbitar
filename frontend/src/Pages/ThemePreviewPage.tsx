import React, {useEffect} from 'react';
import {useAppState} from '../AppState/AppState';
import styles from './FeedPage.module.scss';
import {ThemePreview} from '../Components/ThemePreview';

export default function ThemePreviewPage() {

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


