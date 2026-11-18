import type { ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** "destructive" para eliminar o anular. */
    variant?: 'default' | 'destructive';
    processing?: boolean;
    onConfirm: () => void;
    children?: ReactNode;
};

/**
 * Confirmación estándar para acciones importantes (eliminar, emitir, anular).
 * No se cierra mientras `processing` es verdadero.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'default',
    processing = false,
    onConfirm,
    children,
}: Props) {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => !processing && onOpenChange(next)}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-[0.9375rem]">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                {children}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={processing}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <Button
                        variant={variant}
                        disabled={processing}
                        onClick={onConfirm}
                    >
                        {processing && <Spinner />}
                        {confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
