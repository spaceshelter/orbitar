import {useEffect} from 'react';

export default function useNoScroll() {
    useEffect(() => {
        const htmlElement = document.getElementsByTagName('html')[0];
        htmlElement.classList.add('no-scroll');
        return () => {
            htmlElement.classList.remove('no-scroll');
        };
    }, []);
}