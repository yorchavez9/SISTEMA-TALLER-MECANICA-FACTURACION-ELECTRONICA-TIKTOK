const dateTimeFormat = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
});

const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const moneyFormat = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
});

const quantityFormat = new Intl.NumberFormat('es-PE', {
    maximumFractionDigits: 3,
});

/** Monto en soles: "S/ 1,234.50". Acepta números o strings decimales del backend. */
export function formatMoney(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    return moneyFormat.format(Number(value));
}

/** Cantidad sin ceros sobrantes: "12", "1.5", "0.125". */
export function formatQuantity(
    value: string | number | null | undefined,
): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    return quantityFormat.format(Number(value));
}

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
