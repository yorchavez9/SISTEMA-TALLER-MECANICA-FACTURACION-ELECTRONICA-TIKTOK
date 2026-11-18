import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone =
    | 'neutral'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger';

const TONES: Record<StatusTone, string> = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-link',
    success: 'bg-success/12 text-success-foreground',
    warning: 'bg-warning/15 text-warning-foreground',
    danger: 'bg-destructive/10 text-destructive-foreground',
};

type Props = {
    tone?: StatusTone;
    children: ReactNode;
    className?: string;
};

/**
 * Indicador de estado (OT, venta, SUNAT...). Cada módulo define su propio
 * mapa estado → { label, tone } y usa este componente para mostrarlo.
 */
export function StatusBadge({ tone = 'neutral', children, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap',
                TONES[tone],
                className,
            )}
        >
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            <span className="truncate">{children}</span>
        </span>
    );
}
