import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatMoney } from '@/lib/format';
import { update as updateItem } from '@/routes/work-orders/items';
import type { WorkOrderItemRow } from './types';

type Props = {
    orderId: number;
    /** Ítem a editar; null cierra el diálogo. */
    item: WorkOrderItemRow | null;
    onClose: () => void;
};

export function EditItemDialog({ orderId, item, onClose }: Props) {
    const form = useForm({ description: '', quantity: '', unit_price: '' });

    useEffect(() => {
        if (item) {
            form.setData({
                description: item.description,
                quantity: String(Number(item.quantity)),
                unit_price: String(Number(item.unit_price)),
            });
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item]);

    const lineTotal =
        (Number(form.data.quantity) || 0) * (Number(form.data.unit_price) || 0);

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!item) {
            return;
        }

        form.put(updateItem.url({ workOrder: orderId, item: item.id }), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog
            open={item !== null}
            onOpenChange={(open) => !open && !form.processing && onClose()}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>Editar ítem</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            {item?.type_label}. Precios con IGV incluido.
                        </DialogDescription>
                    </DialogHeader>

                    <FormField
                        label="Descripción"
                        htmlFor="edit_item_description"
                        error={form.errors.description}
                        required
                    >
                        <Input
                            id="edit_item_description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            maxLength={255}
                            className="h-10 text-[0.9375rem]"
                            autoComplete="off"
                        />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            label={`Cantidad (${item?.unit ?? ''})`}
                            htmlFor="edit_item_quantity"
                            error={form.errors.quantity}
                            required
                        >
                            <Input
                                id="edit_item_quantity"
                                type="number"
                                inputMode="decimal"
                                min={0.001}
                                step={0.001}
                                value={form.data.quantity}
                                onChange={(e) =>
                                    form.setData('quantity', e.target.value)
                                }
                                className="h-10 text-[0.9375rem] tabular-nums"
                            />
                        </FormField>
                        <FormField
                            label="Precio unit. (S/)"
                            htmlFor="edit_item_unit_price"
                            error={form.errors.unit_price}
                            required
                        >
                            <Input
                                id="edit_item_unit_price"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.01}
                                value={form.data.unit_price}
                                onChange={(e) =>
                                    form.setData('unit_price', e.target.value)
                                }
                                className="h-10 text-[0.9375rem] tabular-nums"
                            />
                        </FormField>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-[0.9375rem]">
                        <span className="text-muted-foreground">
                            Importe de la línea
                        </span>
                        <span className="font-semibold tabular-nums">
                            {formatMoney(lineTotal)}
                        </span>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={onClose}
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
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
