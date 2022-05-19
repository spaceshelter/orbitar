import React, {useEffect} from 'react';
import styles from './FeedPage.module.scss';
import {ThemePreview} from '../Components/ThemePreview';

export default function ThemePreviewPage() {
    useEffect(() => {
        document.title = 'Тема';
    }, []);

    return (
        <div className={styles.container}>
            <ThemePreview />
        </div>
    );
}


