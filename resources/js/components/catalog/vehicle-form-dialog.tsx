import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { CustomerCombobox } from '@/components/forms/customer-combobox';
import type { CustomerOption } from '@/components/forms/customer-combobox';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
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
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { store, update } from '@/routes/vehicles';

export type VehicleRow = {
    id: number;
    customer_id: number;
    plate: string;
    plate_display: string;
    brand: string;
    model: string;
    year: number | null;
    color: string | null;
    vin: string | null;
    engine_number: string | null;
    current_mileage: number;
    features: string | null;
    notes: string | null;
    customer: CustomerOption | null;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Vehículo a editar; si no se indica, se registra uno nuevo. */
    vehicle?: VehicleRow | null;
    /** Cliente fijo (desde la ficha del cliente): oculta el selector. */
    fixedCustomer?: CustomerOption | null;
};

type VehicleFormData = {
    customer_id: string;
    plate: string;
    brand: string;
    model: string;
    year: string;
    color: string;
    current_mileage: string;
    vin: string;
    engine_number: string;
    features: string;
    notes: string;
};

const EMPTY: VehicleFormData = {
    customer_id: '',
    plate: '',
    brand: '',
    model: '',
    year: '',
    color: '',
    current_mileage: '',
    vin: '',
    engine_number: '',
    features: '',
    notes: '',
};

const MAX_YEAR = new Date().getFullYear() + 1;

/**
 * Diálogo para registrar o editar un vehículo de un cliente.
 */
export function VehicleFormDialog({
    open,
    onOpenChange,
    vehicle,
    fixedCustomer,
}: Props) {
    const form = useForm<VehicleFormData>({ ...EMPTY });
    const errors = form.errors as Record<string, string>;
    const editing = !!vehicle;
    const [customer, setCustomer] = useState<CustomerOption | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const initialCustomer = fixedCustomer ?? vehicle?.customer ?? null;
        setCustomer(initialCustomer);
        form.clearErrors();
        form.setData(
            vehicle
                ? {
                      customer_id: String(vehicle.customer_id),
                      plate: vehicle.plate_display ?? vehicle.plate,
                      brand: vehicle.brand ?? '',
                      model: vehicle.model ?? '',
                      year: vehicle.year ? String(vehicle.year) : '',
                      color: vehicle.color ?? '',
                      current_mileage: String(vehicle.current_mileage ?? ''),
                      vin: vehicle.vin ?? '',
                      engine_number: vehicle.engine_number ?? '',
                      features: vehicle.features ?? '',
                      notes: vehicle.notes ?? '',
                  }
                : {
                      ...EMPTY,
                      customer_id: initialCustomer
                          ? String(initialCustomer.id)
                          : '',
                  },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, vehicle, fixedCustomer]);

    const close = (next: boolean) => {
        if (!form.processing) {
            onOpenChange(next);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
            },
        };

        if (vehicle) {
            form.put(update.url(vehicle.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    const text = (field: keyof VehicleFormData, upper = false) => ({
        value: form.data[field],
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            form.setData(
                field,
                upper ? e.target.value.toUpperCase() : e.target.value,
            ),
    });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Editar vehículo' : 'Nuevo vehículo'}
                        </DialogTitle>
                        <DialogDescription>
                            {fixedCustomer
                                ? `Propietario: ${fixedCustomer.name} · ${fixedCustomer.document}`
                                : 'Registre el vehículo y su propietario.'}
                        </DialogDescription>
                    </DialogHeader>

                    {!fixedCustomer && (
                        <FormField
                            label="Cliente"
                            htmlFor="vehicle_customer"
                            error={errors.customer_id}
                            required
                        >
                            <CustomerCombobox
                                id="vehicle_customer"
                                value={customer}
                                onChange={(selected) => {
                                    setCustomer(selected);
                                    form.setData(
                                        'customer_id',
                                        selected ? String(selected.id) : '',
                                    );
                                }}
                                invalid={!!errors.customer_id}
                                disabled={form.processing}
                            />
                        </FormField>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Placa"
                            htmlFor="vehicle_plate"
                            error={errors.plate}
                            hint="Ej. ABC-123"
                            required
                        >
                            <Input
                                id="vehicle_plate"
                                {...text('plate', true)}
                                maxLength={10}
                                autoComplete="off"
                                aria-invalid={!!errors.plate || undefined}
                                className="h-10 font-medium uppercase tabular-nums"
                            />
                        </FormField>

                        <FormField
                            label="Kilometraje actual"
                            htmlFor="vehicle_current_mileage"
                            error={errors.current_mileage}
                        >
                            <Input
                                id="vehicle_current_mileage"
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={9999999}
                                {...text('current_mileage')}
                                aria-invalid={
                                    !!errors.current_mileage || undefined
                                }
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <FormField
                            label="Marca"
                            htmlFor="vehicle_brand"
                            error={errors.brand}
                            required
                        >
                            <Input
                                id="vehicle_brand"
                                {...text('brand')}
                                maxLength={60}
                                autoComplete="off"
                                aria-invalid={!!errors.brand || undefined}
                                className="h-10"
                            />
                        </FormField>

                        <FormField
                            label="Modelo"
                            htmlFor="vehicle_model"
                            error={errors.model}
                            required
                        >
                            <Input
                                id="vehicle_model"
                                {...text('model')}
                                maxLength={60}
                                autoComplete="off"
                                aria-invalid={!!errors.model || undefined}
                                className="h-10"
                            />
                        </FormField>

                        <FormField
                            label="Año"
                            htmlFor="vehicle_year"
                            error={errors.year}
                        >
                            <Input
                                id="vehicle_year"
                                type="number"
                                inputMode="numeric"
                                min={1950}
                                max={MAX_YEAR}
                                {...text('year')}
                                aria-invalid={!!errors.year || undefined}
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <FormField
                            label="Color"
                            htmlFor="vehicle_color"
                            error={errors.color}
                        >
                            <Input
                                id="vehicle_color"
                                {...text('color')}
                                maxLength={40}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                    </div>

                    <div className="grid gap-5">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                                Más datos
                            </span>
                            <Separator className="flex-1" />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="VIN / chasis"
                                htmlFor="vehicle_vin"
                                error={errors.vin}
                            >
                                <Input
                                    id="vehicle_vin"
                                    {...text('vin', true)}
                                    maxLength={30}
                                    autoComplete="off"
                                    className="h-10 uppercase"
                                />
                            </FormField>

                            <FormField
                                label="Número de motor"
                                htmlFor="vehicle_engine_number"
                                error={errors.engine_number}
                            >
                                <Input
                                    id="vehicle_engine_number"
                                    {...text('engine_number', true)}
                                    maxLength={30}
                                    autoComplete="off"
                                    className="h-10 uppercase"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Características"
                            htmlFor="vehicle_features"
                            error={errors.features}
                            hint="Motor, transmisión, combustible, etc."
                        >
                            <Textarea
                                id="vehicle_features"
                                {...text('features')}
                                maxLength={2000}
                                rows={2}
                                className="text-[0.9375rem]"
                            />
                        </FormField>

                        <FormField
                            label="Observaciones"
                            htmlFor="vehicle_notes"
                            error={errors.notes}
                        >
                            <Textarea
                                id="vehicle_notes"
                                {...text('notes')}
                                maxLength={2000}
                                rows={2}
                                className="text-[0.9375rem]"
                            />
                        </FormField>
                    </div>

                    <InputError message={errors.api} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => close(false)}
                            disabled={form.processing}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {editing ? 'Guardar cambios' : 'Registrar vehículo'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
