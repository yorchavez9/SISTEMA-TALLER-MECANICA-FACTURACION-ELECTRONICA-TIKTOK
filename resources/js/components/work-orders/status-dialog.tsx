import { useForm } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
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
import { status as statusRoute } from '@/routes/work-orders';
import type { StatusOption, WorkOrderDetail } from './types';

type Props = {
    order: WorkOrderDetail;
    /** Estado destino; null cierra el diálogo. */
    target: StatusOption | null;
    onClose: () => void;
};

const DESCRIPTIONS: Partial<Record<StatusOption['value'], string>> = {
    diagnosing: 'El vehículo pasa a revisión para determinar la falla.',
    in_progress: 'Se inicia la reparación del vehículo.',
    finished:
        'El trabajo queda terminado. Los ítems ya no podrán modificarse; la venta y el comprobante se generan desde la orden finalizada.',
    delivered: 'El vehículo fue entregado al cliente.',
    pending: 'La orden vuelve a quedar pendiente de atención.',
};

export function StatusDialog({ order, target, onClose }: Props) {
    const form = useForm({ status: '', note: '' });
    const isCancel = target?.value === 'cancelled';

    useEffect(() => {
        if (target) {
            form.setData({ status: target.value, note: '' });
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(statusRoute.url(order.id), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => !open && !form.processing && onClose()}
        >
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {isCancel
                                ? `¿Cancelar la orden ${order.code}?`
                                : `Cambiar estado a "${target?.label ?? ''}"`}
                        </DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            {isCancel
                                ? 'La orden quedará cancelada y no podrá modificarse. Esta acción no se puede deshacer.'
                                : `Orden ${order.code}: ${order.status_label} → ${target?.label ?? ''}. ${
                                      target
                                          ? (DESCRIPTIONS[target.value] ?? '')
                                          : ''
                                  }`}
                        </DialogDescription>
                    </DialogHeader>

                    {isCancel && (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertDescription className="text-sm">
                                La orden quedará cancelada y no podrá
                                modificarse.
                            </AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        label={
                            isCancel ? 'Motivo (opcional)' : 'Nota (opcional)'
                        }
                        htmlFor="status_note"
                        error={form.errors.note}
                        hint="Quedará registrada en el historial de la orden."
                    >
                        <Textarea
                            id="status_note"
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            maxLength={500}
                            rows={3}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <InputError message={form.errors.status} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={onClose}
                            disabled={form.processing}
                        >
                            Volver
                        </Button>
                        <Button
                            type="submit"
                            className="h-10"
                            variant={isCancel ? 'destructive' : 'default'}
                            disabled={form.processing}
                        >
                            {form.processing && <Spinner />}
                            {isCancel ? 'Cancelar orden' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
