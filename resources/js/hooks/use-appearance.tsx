import { router, usePage } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';
import { update as updateAppearanceRoute } from '@/routes/appearance';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly updateAppearance: (mode: Appearance) => void;
};

const APPEARANCES: Appearance[] = ['light', 'dark', 'system'];

const listeners = new Set<() => void>();
let currentAppearance: Appearance = 'system';

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredAppearance = (): Appearance => {
    if (typeof window === 'undefined') {
        return 'system';
    }

    try {
        const stored = localStorage.getItem('appearance') as Appearance | null;

        return stored && APPEARANCES.includes(stored) ? stored : 'system';
    } catch {
        return 'system';
    }
};

const isDarkMode = (appearance: Appearance): boolean => {
    return appearance === 'dark' || (appearance === 'system' && prefersDark());
};

const applyTheme = (appearance: Appearance): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const isDark = isDarkMode(appearance);

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => applyTheme(currentAppearance);

/**
 * El HTML del servidor ya sincronizó localStorage con la preferencia del
 * usuario (ver app.blade.php); aquí solo se aplica y se escucha el sistema.
 */
export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentAppearance = getStoredAppearance();
    setCookie('appearance', currentAppearance);
    applyTheme(currentAppearance);

    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function useAppearance(): UseAppearanceReturn {
    const { auth } = usePage().props;

    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => currentAppearance,
        () => 'system',
    );

    const resolvedAppearance: ResolvedAppearance = isDarkMode(appearance)
        ? 'dark'
        : 'light';

    const updateAppearance = (mode: Appearance): void => {
        currentAppearance = mode;

        try {
            localStorage.setItem('appearance', mode);
        } catch {
            // Sin almacenamiento local (modo privado): basta con la cookie.
        }

        setCookie('appearance', mode);
        applyTheme(mode);
        notify();

        // Persistir la preferencia en la cuenta del usuario.
        if (auth.user && auth.user.theme !== mode) {
            router.patch(
                updateAppearanceRoute.url(),
                { theme: mode },
                {
                    preserveScroll: true,
                    preserveState: true,
                    only: ['auth'],
                },
            );
        }
    };

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
