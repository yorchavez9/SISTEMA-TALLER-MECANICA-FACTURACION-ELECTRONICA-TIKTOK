import { router } from '@inertiajs/react';

/**
 * Aplica filtros de un listado mediante la query string (búsqueda, filtros,
 * página). Mantiene el estado y el scroll y reinicia la paginación.
 */
export function useTableFilters<F extends Record<string, unknown>>(
    url: string,
    current: F,
) {
    return (changes: Partial<F>) => {
        const next: Record<string, unknown> = { ...current, ...changes };

        // No enviar parámetros vacíos.
        Object.keys(next).forEach((key) => {
            if (
                next[key] === '' ||
                next[key] === null ||
                next[key] === undefined
            ) {
                delete next[key];
            }
        });

        router.get(url, next as Record<string, string>, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };
}
