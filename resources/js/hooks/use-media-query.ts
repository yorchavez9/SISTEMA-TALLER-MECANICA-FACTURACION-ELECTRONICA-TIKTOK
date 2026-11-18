import { useSyncExternalStore } from 'react';

/**
 * Suscripción a una media query CSS (por ejemplo "(min-width: 768px)").
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (callback) => {
            const mql = window.matchMedia(query);
            mql.addEventListener('change', callback);

            return () => mql.removeEventListener('change', callback);
        },
        () => window.matchMedia(query).matches,
        () => false,
    );
}

/** Breakpoints de Tailwind usados por las tablas responsive. */
export function useBreakpoints() {
    const isTablet = useMediaQuery('(min-width: 768px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    return { isMobile: !isTablet, isTablet, isDesktop };
}
