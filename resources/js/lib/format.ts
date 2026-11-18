const dateTimeFormat = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
});

const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function formatDateTime(iso: string | null | undefined): string {
    return iso ? dateTimeFormat.format(new Date(iso)) : '—';
}

/** "hace 5 minutos", "ayer", etc. */
export function formatRelative(iso: string): string {
    const diffSeconds = Math.round(
        (new Date(iso).getTime() - Date.now()) / 1000,
    );
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];

    for (const [unit, seconds] of units) {
        if (Math.abs(diffSeconds) >= seconds) {
            return relativeFormat.format(
                Math.round(diffSeconds / seconds),
                unit,
            );
        }
    }

    return 'hace un momento';
}
