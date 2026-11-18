import { useEffect, useRef } from 'react';

/**
 * Devuelve una función que ejecuta `callback` solo cuando dejan de llegar
 * llamadas durante `delay` milisegundos.
 */
export function useDebouncedCallback<Args extends unknown[]>(
    callback: (...args: Args) => void,
    delay = 300,
): (...args: Args) => void {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(callback);

    useEffect(() => {
        latest.current = callback;
    }, [callback]);

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        };
    }, []);

    return (...args: Args) => {
        if (timer.current) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => latest.current(...args), delay);
    };
}
