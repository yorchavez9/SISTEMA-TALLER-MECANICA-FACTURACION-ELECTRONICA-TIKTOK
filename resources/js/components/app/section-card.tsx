import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    description?: ReactNode;
    /** Acción en la cabecera (por ejemplo un botón "Agregar"). */
    action?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    className?: string;
    /** Sin relleno interno (para tablas que ocupan todo el ancho). */
    flush?: boolean;
};

/**
 * Bloque de contenido con título. Fondo de tarjeta, borde fino, sin sombra.
 */
export function SectionCard({
    title,
    description,
    action,
    footer,
    children,
    className,
    flush,
}: Props) {
    return (
        <section className={cn('min-w-0 rounded-xl border bg-card', className)}>
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h2 className="text-base font-semibold">{title}</h2>
                    {description && (
                        <p className="text-[0.9375rem] text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            {children !== undefined && (
                <div className={flush ? '' : 'px-5 py-5'}>{children}</div>
            )}
            {footer && (
                <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
                    {footer}
                </div>
            )}
        </section>
    );
}
