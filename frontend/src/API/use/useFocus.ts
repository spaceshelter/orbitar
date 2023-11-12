import { useEffect, useRef, MutableRefObject } from 'react';

export default function useFocus<T extends HTMLElement = HTMLInputElement>(): MutableRefObject<T | null> {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    return ref;
}