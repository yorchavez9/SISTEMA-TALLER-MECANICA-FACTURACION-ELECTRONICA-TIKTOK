import { usePage } from '@inertiajs/react';

/**
 * Comprueba permisos para mostrar u ocultar elementos de la interfaz.
 * La autorización real siempre se valida en el backend.
 */
export function useCan() {
    const { auth } = usePage().props;

    return (permission: string): boolean =>
        auth.is_super_admin || auth.permissions.includes(permission);
}
