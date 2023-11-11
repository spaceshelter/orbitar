import { useEffect, useRef } from 'react';

export default function useFocus() {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    return ref;
}