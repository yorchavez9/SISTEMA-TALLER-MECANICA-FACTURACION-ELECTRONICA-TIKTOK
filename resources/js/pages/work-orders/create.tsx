import { Head, Link, useForm } from '@inertiajs/react';
import { Car, Check, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { CustomerCombobox } from '@/components/forms/customer-combobox';
import type { CustomerOption } from '@/components/forms/customer-combobox';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { getJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    show as customersShow,
    vehicles as customerVehicles,
} from '@/routes/customers';
import { create, index as workOrdersIndex, store } from '@/routes/work-orders';
import type { Option } from '@/types';

type VehicleOption = {
    id: number;
    plate: string;
    description: string;
    current_mileage: number | null;
};

type Props = {
    mechanics: Option[];
    preselected: {
        customer: CustomerOption | null;
        vehicle_id: number | null;
    };
};

type WorkOrderFormData = {
    customer_id: number | null;
    vehicle_id: number | null;
    mileage_in: string;
    reported_problem: string;
    diagnosis: string;
    observations: string;
    promised_at: string;
    assigned_user_id: string;
};

/** Radix Select no admite '' como valor: se usa un centinela y se envía null. */
const UNASSIGNED = 'none';

const kmFormat = new Intl.NumberFormat('es-PE');

/** Hoy (AAAA-MM-DD) en hora de Lima, mínimo para la fecha de entrega. */
const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
        new Date(),
    );

export default function WorkOrderCreate({ mechanics, preselected }: Props) {
    const [customer, setCustomer] = useState<CustomerOption | null>(
        preselected.customer,
    );
    const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [vehiclesError, setVehiclesError] = useState(false);

    const form = useForm<WorkOrderFormData>({
        customer_id: preselected.customer?.id ?? null,
        vehicle_id: preselected.vehicle_id,
        mileage_in: '',
        reported_problem: '',
        diagnosis: '',
        observations: '',
        promised_at: '',
        assigned_user_id: UNASSIGNED,
    });
    const errors = form.errors as Record<string, string>;

    const selectedVehicle =
        vehicles.find((v) => v.id === form.data.vehicle_id) ?? null;

    // Carga los vehículos del cliente elegido.
    useEffect(() => {
        if (!customer) {
            setVehicles([]);

            return;
        }

        let cancelled = false;
        setLoadingVehicles(true);
        setVehiclesError(false);

        getJson<{ items: VehicleOption[] }>(customerVehicles.url(customer.id))
            .then((data) => {
                if (cancelled) {
                    return;
                }

                setVehicles(data.items);

                // Si solo tiene un vehículo, se selecciona; si había uno
                // preseleccionado, se completa su kilometraje.
                form.setData((current) => {
                    const vehicle =
                        data.items.find((v) => v.id === current.vehicle_id) ??
                        (data.items.length === 1 ? data.items[0] : null);

                    return {
                        ...current,
                        vehicle_id: vehicle?.id ?? null,
                        mileage_in:
                            current.mileage_in === '' &&
                            vehicle?.current_mileage != null
                                ? String(vehicle.current_mileage)
                                : current.mileage_in,
                    };
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setVehicles([]);
                    setVehiclesError(true);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingVehicles(false);
                }
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer?.id]);

    const selectCustomer = (next: CustomerOption | null) => {
        setCustomer(next);
        form.setData((current) => ({
            ...current,
            customer_id: next?.id ?? null,
            vehicle_id: null,
            mileage_in: '',
        }));
        form.clearErrors('customer_id', 'vehicle_id');
    };

    const selectVehicle = (vehicle: VehicleOption) => {
        const previousMileage =
            selectedVehicle?.current_mileage != null
                ? String(selectedVehicle.current_mileage)
                : '';

        form.setData((current) => ({
            ...current,
            vehicle_id: vehicle.id,
            // Se propone el km actual si el campo está vacío o aún tiene
            // el valor propuesto para el vehículo anterior.
            mileage_in:
                current.mileage_in === '' ||
                current.mileage_in === previousMileage
                    ? vehicle.current_mileage != null
                        ? String(vehicle.current_mileage)
                        : ''
                    : current.mileage_in,
        }));
        form.clearErrors('vehicle_id');
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            mileage_in: data.mileage_in === '' ? null : Number(data.mileage_in),
            diagnosis: data.diagnosis.trim() || null,
            observations: data.observations.trim() || null,
            promised_at: data.promised_at || null,
            assigned_user_id:
                data.assigned_user_id === UNASSIGNED
                    ? null
                    : Number(data.assigned_user_id),
        }));
        form.post(store.url(), { preserveScroll: true });
    };

    const mileageHint =
        selectedVehicle?.current_mileage != null
            ? `Km actual registrado: ${kmFormat.format(selectedVehicle.current_mileage)}`
            : 'Opcional.';

    return (
        <>
            <Head title="Nueva orden de trabajo" />

            <PageContainer>
                <PageHeader
                    title="Nueva orden de trabajo"
                    description="Registre el ingreso de un vehículo al taller."
                />

                <form onSubmit={submit} className="grid gap-6">
                    <SectionCard title="Cliente y vehículo">
                        <div className="grid gap-5">
                            <FormField
                                label="Cliente"
                                htmlFor="customer_id"
                                error={errors.customer_id}
                                required
                            >
                                <CustomerCombobox
                                    id="customer_id"
                                    value={customer}
                                    onChange={selectCustomer}
                                    invalid={!!errors.customer_id}
                                />
                            </FormField>

                            {customer && (
                                <div className="grid min-w-0 gap-2">
                                    <p
                                        id="vehicle-label"
                                        className="text-[0.9375rem] font-medium"
                                    >
                                        Vehículo
                                        <span
                                            className="text-destructive-foreground"
                                            aria-hidden
                                        >
                                            *
                                        </span>
                                    </p>

                                    {loadingVehicles ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <Skeleton className="h-20 rounded-lg" />
                                            <Skeleton className="h-20 rounded-lg" />
                                        </div>
                                    ) : vehiclesError ? (
                                        <p className="text-[0.9375rem] text-destructive-foreground">
                                            No se pudieron cargar los vehículos
                                            del cliente. Vuelva a seleccionarlo
                                            para reintentar.
                                        </p>
                                    ) : vehicles.length === 0 ? (
                                        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-start gap-3">
                                                <Car className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                                                <p className="text-[0.9375rem] text-muted-foreground">
                                                    Este cliente no tiene
                                                    vehículos registrados.
                                                    Registre uno en la ficha del
                                                    cliente para continuar.
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                asChild
                                                className="shrink-0"
                                            >
                                                <Link
                                                    href={customersShow(
                                                        customer.id,
                                                    )}
                                                >
                                                    <Plus />
                                                    Registrar vehículo
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            role="radiogroup"
                                            aria-labelledby="vehicle-label"
                                            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                                        >
                                            {vehicles.map((vehicle) => {
                                                const selected =
                                                    form.data.vehicle_id ===
                                                    vehicle.id;

                                                return (
                                                    <button
                                                        key={vehicle.id}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() =>
                                                            selectVehicle(
                                                                vehicle,
                                                            )
                                                        }
                                                        className={cn(
                                                            'flex min-w-0 items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                                                            selected
                                                                ? 'border-primary bg-primary/5'
                                                                : 'hover:bg-muted/60',
                                                            errors.vehicle_id &&
                                                                !selected &&
                                                                'border-destructive/50',
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                                                                selected
                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                    : 'border-input',
                                                            )}
                                                        >
                                                            {selected && (
                                                                <Check className="size-3.5" />
                                                            )}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block font-semibold tabular-nums">
                                                                {vehicle.plate}
                                                            </span>
                                                            <span className="block text-[0.9375rem] break-words">
                                                                {vehicle.description ||
                                                                    '—'}
                                                            </span>
                                                            <span className="block text-sm text-muted-foreground tabular-nums">
                                                                Km actual:{' '}
                                                                {kmFormat.format(
                                                                    vehicle.current_mileage ??
                                                                        0,
                                                                )}
                                                            </span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <InputError message={errors.vehicle_id} />
                                </div>
                            )}

                            {!customer && errors.vehicle_id && (
                                <InputError message={errors.vehicle_id} />
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Ingreso">
                        <div className="grid gap-5">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <FormField
                                    label="Kilometraje de ingreso"
                                    htmlFor="mileage_in"
                                    error={errors.mileage_in}
                                    hint={mileageHint}
                                >
                                    <Input
                                        id="mileage_in"
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        value={form.data.mileage_in}
                                        onChange={(e) =>
                                            form.setData(
                                                'mileage_in',
                                                e.target.value,
                                            )
                                        }
                                        className="h-10 tabular-nums"
                                    />
                                </FormField>

                                <FormField
                                    label="Fecha prometida de entrega"
                                    htmlFor="promised_at"
                                    error={errors.promised_at}
                                    hint="Opcional."
                                >
                                    <Input
                                        id="promised_at"
                                        type="date"
                                        min={today()}
                                        value={form.data.promised_at}
                                        onChange={(e) =>
                                            form.setData(
                                                'promised_at',
                                                e.target.value,
                                            )
                                        }
                                        className="h-10 tabular-nums"
                                    />
                                </FormField>
                            </div>

                            <FormField
                                label="Problema reportado por el cliente"
                                htmlFor="reported_problem"
                                error={errors.reported_problem}
                                required
                            >
                                <Textarea
                                    id="reported_problem"
                                    value={form.data.reported_problem}
                                    onChange={(e) =>
                                        form.setData(
                                            'reported_problem',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={5000}
                                    rows={4}
                                    placeholder="Ej.: ruido al frenar, luz de check encendida…"
                                    className="text-[0.9375rem]"
                                />
                            </FormField>

                            <FormField
                                label="Técnico asignado"
                                htmlFor="assigned_user_id"
                                error={errors.assigned_user_id}
                                className="sm:max-w-sm"
                            >
                                <SelectInput
                                    id="assigned_user_id"
                                    value={form.data.assigned_user_id}
                                    onChange={(value) =>
                                        form.setData('assigned_user_id', value)
                                    }
                                    options={[
                                        {
                                            value: UNASSIGNED,
                                            label: 'Sin asignar',
                                        },
                                        ...mechanics,
                                    ]}
                                    invalid={!!errors.assigned_user_id}
                                />
                            </FormField>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Diagnóstico inicial (opcional)"
                        description="Puede completarlo ahora o más adelante desde el detalle de la orden."
                    >
                        <div className="grid gap-5">
                            <FormField
                                label="Diagnóstico"
                                htmlFor="diagnosis"
                                error={errors.diagnosis}
                            >
                                <Textarea
                                    id="diagnosis"
                                    value={form.data.diagnosis}
                                    onChange={(e) =>
                                        form.setData(
                                            'diagnosis',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={5000}
                                    rows={3}
                                    className="text-[0.9375rem]"
                                />
                            </FormField>

                            <FormField
                                label="Observaciones"
                                htmlFor="observations"
                                error={errors.observations}
                                hint="Estado del vehículo al ingreso, objetos dejados, etc."
                            >
                                <Textarea
                                    id="observations"
                                    value={form.data.observations}
                                    onChange={(e) =>
                                        form.setData(
                                            'observations',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={5000}
                                    rows={3}
                                    className="text-[0.9375rem]"
                                />
                            </FormField>
                        </div>
                    </SectionCard>

                    <InputError message={errors.api} />

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href={workOrdersIndex()}>Cancelar</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Registrar orden
                        </Button>
                    </div>
                </form>
            </PageContainer>
        </>
    );
}

WorkOrderCreate.layout = {
    breadcrumbs: [
        { title: 'Órdenes de trabajo', href: workOrdersIndex() },
        { title: 'Nueva orden', href: create() },
    ],
};
