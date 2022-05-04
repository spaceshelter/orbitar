import React, {useEffect} from 'react';
import './LoadingPage.css';

export default function LoadingPage() {
    document.title = 'ЪУЬ';

    useEffect(() => {
        let int = setInterval(() => {
            const letters = ['Ъ', 'Ь'];
            const id1 = Math.random() > 0.5 ? 0 : 1;
            const id2 = Math.random() > 0.5 ? 0 : 1;
            document.title = letters[id1] + 'У' + letters[id2];
        }, 50);
        return () => { clearInterval(int); }
    });

    return (
        <img className="loading" alt="Loading..." src="/img/robots.gif" />
    );
}
