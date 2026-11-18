import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
    label: string;
    htmlFor?: string;
    error?: string;
    hint?: ReactNode;
    required?: boolean;
    className?: string;
    children: ReactNode;
};

/**
 * Campo de formulario estándar: etiqueta, control, ayuda y mensaje de error.
 */
export function FormField({
    label,
    htmlFor,
    error,
    hint,
    required,
    className,
    children,
}: Props) {
    return (
        <div className={cn('grid min-w-0 gap-2', className)}>
            <Label htmlFor={htmlFor} className="text-[0.9375rem]">
                {label}
                {required && (
                    <span className="text-destructive-foreground" aria-hidden>
                        *
                    </span>
                )}
            </Label>
            {children}
            {hint && !error && (
                <p className="text-sm text-muted-foreground">{hint}</p>
            )}
            <InputError message={error} />
        </div>
    );
}
