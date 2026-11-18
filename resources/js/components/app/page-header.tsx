import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    description?: ReactNode;
    /** Botones de acción (por ejemplo "Nuevo cliente"). */
    actions?: ReactNode;
    className?: string;
};

export function PageHeader({ title, description, actions, className }: Props) {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <p className="text-[0.9375rem] text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}

/** Contenedor estándar de una página dentro del layout de la aplicación. */
export function PageContainer({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6',
                className,
            )}
        >
            {children}
        </div>
    );
}
