import { useForm } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { PaymentsEditor } from '@/components/sales/payments-editor';
import type { PaymentLine } from '@/components/sales/payments-editor';
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
import { store as storeSale } from '@/routes/work-orders/sale';
import type { Option } from '@/types';
import type { WorkOrderDetail } from './types';

type Props = {
    order: WorkOrderDetail;
    itemsCount: number;
    paymentMethods: Option[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type FormData = {
    payments: PaymentLine[];
    notes: string;
};

const initialPayments = (total: string): PaymentLine[] => [
    { method: 'cash', amount: Number(total).toFixed(2), reference: '' },
];

/**
 * Registra la venta de una orden finalizada: los ítems se copian de la orden,
 * aquí solo se indican los pagos y notas.
 */
export function GenerateSaleDialog({
    order,
    itemsCount,
    paymentMethods,
    open,
    onOpenChange,
}: Props) {
    const form = useForm<FormData>({
        payments: initialPayments(order.total),
        notes: '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const total = Number(order.total) || 0;

    // Al abrir, el cobro parte de un solo pago en efectivo por el total actual.
    useEffect(() => {
        if (open) {
            form.setData({ payments: initialPayments(order.total), notes: '' });
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, order.total]);

    const close = () => {
        if (!form.processing) {
            onOpenChange(false);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(storeSale.url(order.id), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
            },
        });
    };

    const blocking = errors.sale ?? errors.stock;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>Generar venta</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Se registrará la venta de la {order.code} con sus
                            ítems actuales. Los repuestos se descuentan del
                            stock.
                        </DialogDescription>
                    </DialogHeader>

                    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 px-4 py-3">
                        <div className="min-w-0">
                            <dt className="text-sm text-muted-foreground">
                                Ítems
                            </dt>
                            <dd className="text-[0.9375rem] font-medium tabular-nums">
                                {itemsCount}
                            </dd>
                        </div>
                        <div className="min-w-0 text-right">
                            <dt className="text-sm text-muted-foreground">
                                Total (con IGV)
                            </dt>
                            <dd className="text-lg font-semibold tabular-nums">
                                {formatMoney(total)}
                            </dd>
                        </div>
                    </dl>

                    {blocking && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertDescription className="text-[0.9375rem]">
                                {errors.sale && <p>{errors.sale}</p>}
                                {errors.stock && <p>{errors.stock}</p>}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid min-w-0 gap-2">
                        <h3 className="text-[0.9375rem] font-medium">Cobro</h3>
                        <PaymentsEditor
                            payments={form.data.payments}
                            onChange={(payments) =>
                                form.setData('payments', payments)
                            }
                            total={total}
                            methods={paymentMethods}
                            errors={errors}
                        />
                    </div>

                    <FormField
                        label="Notas"
                        htmlFor="sale_notes"
                        error={errors.notes}
                        hint="Opcional. Visible en el detalle de la venta."
                    >
                        <Textarea
                            id="sale_notes"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            maxLength={2000}
                            rows={2}
                            className="text-[0.9375rem]"
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
                            className="h-10"
                            disabled={form.processing}
                        >
                            {form.processing && <Spinner />}
                            Registrar venta
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
