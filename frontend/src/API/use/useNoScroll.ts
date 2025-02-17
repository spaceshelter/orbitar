import {useEffect} from 'react';

let noScrollCount = 0;
export default function useNoScroll() {
    useEffect(() => {
        noScrollCount++;
        const htmlElement = document.getElementsByTagName('html')[0];
        htmlElement.classList.add('no-scroll');
        return () => {
            noScrollCount--;
            if (noScrollCount === 0) {
                htmlElement.classList.remove('no-scroll');
            }
        };
    }, []);
}