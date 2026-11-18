import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
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
import { Textarea } from '@/components/ui/textarea';
import { update } from '@/routes/work-orders';
import type { Option } from '@/types';
import type { WorkOrderDetail } from './types';

type Props = {
    order: WorkOrderDetail;
    mechanics: Option[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Valor centinela del select: Radix no admite value="". */
const UNASSIGNED = '__none';

const initialData = (order: WorkOrderDetail) => ({
    reported_problem: order.reported_problem ?? '',
    diagnosis: order.diagnosis ?? '',
    observations: order.observations ?? '',
    mileage_in: order.mileage_in !== null ? String(order.mileage_in) : '',
    promised_at: order.promised_at ?? '',
    assigned_user_id:
        order.assigned_user_id !== null ? String(order.assigned_user_id) : '',
});

export function EditHeaderDialog({
    order,
    mechanics,
    open,
    onOpenChange,
}: Props) {
    const form = useForm(initialData(order));

    useEffect(() => {
        if (open) {
            form.setData(initialData(order));
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mechanicOptions: Option[] = [
        { value: UNASSIGNED, label: 'Sin asignar' },
        ...mechanics,
    ];

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            diagnosis: data.diagnosis.trim() || null,
            observations: data.observations.trim() || null,
            mileage_in: data.mileage_in === '' ? null : Number(data.mileage_in),
            promised_at: data.promised_at || null,
            assigned_user_id: data.assigned_user_id
                ? Number(data.assigned_user_id)
                : null,
        }));
        form.put(update.url(order.id), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => !form.processing && onOpenChange(next)}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>Editar datos de la orden</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Cliente y vehículo no se pueden cambiar.
                        </DialogDescription>
                    </DialogHeader>

                    <FormField
                        label="Problema reportado"
                        htmlFor="reported_problem"
                        error={form.errors.reported_problem}
                        required
                    >
                        <Textarea
                            id="reported_problem"
                            value={form.data.reported_problem}
                            onChange={(e) =>
                                form.setData('reported_problem', e.target.value)
                            }
                            rows={3}
                            maxLength={5000}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <FormField
                        label="Diagnóstico"
                        htmlFor="diagnosis"
                        error={form.errors.diagnosis}
                    >
                        <Textarea
                            id="diagnosis"
                            value={form.data.diagnosis}
                            onChange={(e) =>
                                form.setData('diagnosis', e.target.value)
                            }
                            rows={3}
                            maxLength={5000}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <FormField
                        label="Observaciones"
                        htmlFor="observations"
                        error={form.errors.observations}
                    >
                        <Textarea
                            id="observations"
                            value={form.data.observations}
                            onChange={(e) =>
                                form.setData('observations', e.target.value)
                            }
                            rows={2}
                            maxLength={5000}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            label="Kilometraje de ingreso"
                            htmlFor="mileage_in"
                            error={form.errors.mileage_in}
                        >
                            <Input
                                id="mileage_in"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={form.data.mileage_in}
                                onChange={(e) =>
                                    form.setData('mileage_in', e.target.value)
                                }
                                className="h-10 text-[0.9375rem] tabular-nums"
                            />
                        </FormField>
                        <FormField
                            label="Fecha prometida"
                            htmlFor="promised_at"
                            error={form.errors.promised_at}
                        >
                            <Input
                                id="promised_at"
                                type="date"
                                value={form.data.promised_at}
                                onChange={(e) =>
                                    form.setData('promised_at', e.target.value)
                                }
                                className="h-10 text-[0.9375rem]"
                            />
                        </FormField>
                    </div>

                    <FormField
                        label="Técnico asignado"
                        htmlFor="assigned_user_id"
                        error={form.errors.assigned_user_id}
                    >
                        <SelectInput
                            id="assigned_user_id"
                            value={form.data.assigned_user_id || UNASSIGNED}
                            onChange={(value) =>
                                form.setData(
                                    'assigned_user_id',
                                    value === UNASSIGNED ? '' : value,
                                )
                            }
                            options={mechanicOptions}
                        />
                    </FormField>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={() => onOpenChange(false)}
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
