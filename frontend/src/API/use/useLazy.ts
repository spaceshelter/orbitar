import {DependencyList, useEffect, useRef} from 'react';

/**
 * Returns a function that wraps the given function and memoizes its result.
 * The difference from useMemo is that the function is not called on every render.
 * @param fn the function to memoize
 * @param deps
 */
export function useLazy<T>(fn: () => T, deps?: DependencyList): () => T {
    const isSet = useRef<boolean>(false);
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = undefined;
        isSet.current = false;
    }, [deps]);
    return () => {
        if (!isSet.current) {
            ref.current = fn();
            isSet.current = true;
        }
        return ref.current as T;
    };
}