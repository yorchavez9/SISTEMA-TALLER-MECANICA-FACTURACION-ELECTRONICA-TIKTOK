import { useForm } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import { creditNote } from '@/routes/documents';
import type { DocumentRow } from './types';

const MIN_LENGTH = 5;
const DEFAULT_DESCRIPTION = 'Anulación de la operación';

type Props = {
    document: DocumentRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/**
 * Anula un comprobante aceptado emitiendo una nota de crédito (motivo 01)
 * por el total.
 */
export function CreditNoteDialog({ document, open, onOpenChange }: Props) {
    const form = useForm({ description: DEFAULT_DESCRIPTION });
    const errors = form.errors as Record<string, string | undefined>;
    const tooShort = form.data.description.trim().length < MIN_LENGTH;

    useEffect(() => {
        if (open) {
            form.setData('description', DEFAULT_DESCRIPTION);
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, document?.id]);

    const close = () => {
        if (!form.processing) {
            onOpenChange(false);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!document) {
            return;
        }

        if (tooShort) {
            form.setError(
                'description',
                `El motivo debe tener al menos ${MIN_LENGTH} caracteres.`,
            );

            return;
        }

        form.post(creditNote.url(document.id), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    const blocking = errors.credit_note ?? errors.document ?? errors.api;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            Anular {document?.document_type_label}{' '}
                            <span className="tabular-nums">
                                {document?.number}
                            </span>
                        </DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Se emitirá una nota de crédito (motivo 01) por el
                            total
                            {document && (
                                <>
                                    {' '}
                                    <span className="font-medium whitespace-nowrap tabular-nums">
                                        ({formatMoney(document.total)})
                                    </span>
                                </>
                            )}
                            . Cuando SUNAT la acepte, la venta se anulará y el
                            stock volverá al inventario.
                        </DialogDescription>
                    </DialogHeader>

                    {blocking && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertDescription className="text-[0.9375rem]">
                                {blocking}
                            </AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        label="Motivo de la anulación"
                        htmlFor="credit_note_description"
                        error={errors.description}
                        hint={`Mínimo ${MIN_LENGTH} caracteres. Se incluye en la nota de crédito.`}
                        required
                    >
                        <Textarea
                            id="credit_note_description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            rows={3}
                            maxLength={250}
                            aria-invalid={!!errors.description || undefined}
                            className="text-[0.9375rem]"
                            autoFocus
                        />
                    </FormField>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={close}
                            disabled={form.processing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            className="h-10"
                            disabled={form.processing || tooShort || !document}
                        >
                            {form.processing && <Spinner />}
                            Emitir nota de crédito
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
