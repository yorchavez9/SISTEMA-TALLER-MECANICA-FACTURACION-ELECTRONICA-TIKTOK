import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';

export type DocumentStatus =
    | 'sending'
    | 'failed'
    | 'unknown'
    | 'pending'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'voided';

type Props = {
    // Valor de DocumentStatus (string para tolerar estados nuevos del backend).
    status: string;
    label: string;
    tone: string;
    className?: string;
};

const KNOWN_TONES: StatusTone[] = [
    'neutral',
    'primary',
    'success',
    'warning',
    'danger',
];

/**
 * Estado SUNAT de un comprobante electrónico. El backend envía la etiqueta
 * y el tono (status_label / status_tone).
 */
export function DocumentStatusBadge({ status, label, tone, className }: Props) {
    const safeTone = KNOWN_TONES.includes(tone as StatusTone)
        ? (tone as StatusTone)
        : 'neutral';

    return (
        <StatusBadge tone={safeTone} className={className}>
            <span data-status={status}>{label}</span>
        </StatusBadge>
    );
}
