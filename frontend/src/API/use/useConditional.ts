import {useRef} from 'react';

/**
 * Bumps the value of a variable to the next value if condition is true.
 */
export function useConditional(conditional: boolean): number {
    const ref = useRef<number>(0);
    if (conditional) {
        ref.current++;
    }
    return ref.current;
}