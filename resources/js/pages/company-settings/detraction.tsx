import { Head, useForm } from '@inertiajs/react';
import { Info, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    index as detractionIndex,
    settings as settingsRoute,
} from '@/routes/company-settings/detraction';
import {
    store as storeType,
    update as updateType,
} from '@/routes/company-settings/detraction/types';
import type { Option } from '@/types';

type Settings = {
    detraction_enabled: boolean;
    detraction_account: string | null;
    detraction_payment_method: string;
    detraction_threshold: string;
};

type DetractionTypeRow = {
    id: number;
    code: string;
    description: string;
    rate: string;
    is_active: boolean;
    is_default: boolean;
};

type Props = {
    settings: Settings;
    types: DetractionTypeRow[];
};

const PAYMENT_METHODS: Option[] = [
    { value: '001', label: '001 – Depósito en cuenta' },
];

const EMPTY_TYPE = {
    code: '',
    description: '',
    rate: '',
    is_active: true,
    is_default: false,
};

export default function DetractionPage({ settings, types }: Props) {
    const settingsForm = useForm({
        detraction_enabled: settings.detraction_enabled,
        detraction_account: settings.detraction_account ?? '',
        detraction_payment_method: settings.detraction_payment_method || '001',
        detraction_threshold: settings.detraction_threshold ?? '700.00',
    });
    const settingsErrors = settingsForm.errors as Record<string, string>;

    const paymentMethods = PAYMENT_METHODS.some(
        (o) => o.value === settingsForm.data.detraction_payment_method,
    )
        ? PAYMENT_METHODS
        : [
              ...PAYMENT_METHODS,
              {
                  value: settingsForm.data.detraction_payment_method,
                  label: settingsForm.data.detraction_payment_method,
              },
          ];

    const submitSettings = (e: FormEvent) => {
        e.preventDefault();
        settingsForm.put(settingsRoute.url(), { preserveScroll: true });
    };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<DetractionTypeRow | null>(null);
    const typeForm = useForm({ ...EMPTY_TYPE });
    const typeErrors = typeForm.errors as Record<string, string>;

    const openCreate = () => {
        setEditing(null);
        typeForm.clearErrors();
        typeForm.setData({ ...EMPTY_TYPE });
        setDialogOpen(true);
    };

    const openEdit = (row: DetractionTypeRow) => {
        setEditing(row);
        typeForm.clearErrors();
        typeForm.setData({
            code: row.code,
            description: row.description,
            rate: row.rate,
            is_active: row.is_active,
            is_default: row.is_default,
        });
        setDialogOpen(true);
    };

    const submitType = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                setEditing(null);
                typeForm.reset();
            },
        };

        if (editing) {
            typeForm.put(updateType.url(editing.id), options);
        } else {
            typeForm.post(storeType.url(), options);
        }
    };

    const columns: DataTableColumn<DetractionTypeRow>[] = [
        {
            id: 'code',
            header: 'Código',
            priority: 'primary',
            cell: (row) => (
                <span className="font-medium tabular-nums">{row.code}</span>
            ),
        },
        {
            id: 'description',
            header: 'Descripción',
            priority: 'primary',
            cell: (row) => row.description,
        },
        {
            id: 'rate',
            header: 'Porcentaje',
            priority: 'md',
            className: 'tabular-nums',
            cell: (row) => `${row.rate} %`,
        },
        {
            id: 'status',
            header: 'Estado',
            priority: 'md',
            cell: (row) => (
                <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
            ),
        },
        {
            id: 'default',
            header: 'Predeterminado',
            priority: 'lg',
            cell: (row) =>
                row.is_default ? (
                    <StatusBadge tone="primary">Predeterminado</StatusBadge>
                ) : (
                    '—'
                ),
        },
    ];

    return (
        <>
            <Head title="Detracción" />

            <form onSubmit={submitSettings}>
                <SectionCard
                    title="Configuración general"
                    description="Datos que se usan al emitir facturas de servicios sujetas al sistema de detracciones (SPOT)."
                    footer={
                        <Button
                            type="submit"
                            disabled={settingsForm.processing}
                        >
                            {settingsForm.processing && <Spinner />}
                            Guardar configuración
                        </Button>
                    }
                >
                    <div className="grid gap-5">
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="detraction_enabled"
                                checked={settingsForm.data.detraction_enabled}
                                onCheckedChange={(checked) =>
                                    settingsForm.setData(
                                        'detraction_enabled',
                                        checked === true,
                                    )
                                }
                                className="mt-0.5"
                            />
                            <div className="grid gap-1">
                                <Label
                                    htmlFor="detraction_enabled"
                                    className="text-[0.9375rem]"
                                >
                                    Aplicar detracción a facturas de servicios
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Se propondrá la detracción en las facturas
                                    cuyo total supere el monto mínimo.
                                </p>
                                <InputError
                                    message={settingsErrors.detraction_enabled}
                                />
                            </div>
                        </div>

                        <FormField
                            label="Cuenta de detracciones (Banco de la Nación)"
                            htmlFor="detraction_account"
                            error={settingsErrors.detraction_account}
                            hint="Solo números y guiones."
                            required={settingsForm.data.detraction_enabled}
                        >
                            <Input
                                id="detraction_account"
                                value={settingsForm.data.detraction_account}
                                onChange={(e) =>
                                    settingsForm.setData(
                                        'detraction_account',
                                        e.target.value
                                            .replace(/[^0-9-]/g, '')
                                            .slice(0, 30),
                                    )
                                }
                                inputMode="numeric"
                                maxLength={30}
                                autoComplete="off"
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Medio de pago"
                                htmlFor="detraction_payment_method"
                                error={settingsErrors.detraction_payment_method}
                                required
                            >
                                <SelectInput
                                    id="detraction_payment_method"
                                    value={
                                        settingsForm.data
                                            .detraction_payment_method
                                    }
                                    onChange={(value) =>
                                        settingsForm.setData(
                                            'detraction_payment_method',
                                            value,
                                        )
                                    }
                                    options={paymentMethods}
                                />
                            </FormField>

                            <FormField
                                label="Monto mínimo de la factura (S/)"
                                htmlFor="detraction_threshold"
                                error={settingsErrors.detraction_threshold}
                                hint="Normalmente S/ 700.00 para servicios."
                                required
                            >
                                <Input
                                    id="detraction_threshold"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    inputMode="decimal"
                                    value={
                                        settingsForm.data.detraction_threshold
                                    }
                                    onChange={(e) =>
                                        settingsForm.setData(
                                            'detraction_threshold',
                                            e.target.value,
                                        )
                                    }
                                    className="h-10 tabular-nums"
                                />
                            </FormField>
                        </div>
                    </div>
                </SectionCard>
            </form>

            <SectionCard
                title="Tipos de detracción"
                description="El porcentaje es dinámico: el taller administra su propia lista de tipos y porcentajes. Al emitir cada factura, el usuario elige el tipo y puede cambiar el porcentaje."
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        Agregar tipo
                    </Button>
                }
                flush
            >
                <div className="grid gap-4 p-4">
                    <Alert>
                        <Info />
                        <AlertDescription className="text-[0.9375rem]">
                            Revise códigos y porcentajes con su contador. Puede
                            cambiarlos cuando SUNAT actualice las tasas; las
                            facturas ya emitidas conservan el porcentaje con que
                            se emitieron.
                        </AlertDescription>
                    </Alert>

                    <ResponsiveDataTable
                        data={types}
                        columns={columns}
                        getRowId={(row) => row.id}
                        caption="Tipos de detracción"
                        actions={(row) => [
                            {
                                label: 'Editar',
                                icon: Pencil,
                                onClick: () => openEdit(row),
                            },
                        ]}
                    />
                </div>
            </SectionCard>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) =>
                    !typeForm.processing && setDialogOpen(open)
                }
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                    <form onSubmit={submitType} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing
                                    ? 'Editar tipo de detracción'
                                    : 'Agregar tipo de detracción'}
                            </DialogTitle>
                            <DialogDescription>
                                Código del bien o servicio según el Anexo de
                                SUNAT y el porcentaje que se propondrá al
                                emitir.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Código"
                                htmlFor="code"
                                error={typeErrors.code}
                                hint="3 dígitos (ej. 020)"
                                required
                            >
                                <Input
                                    id="code"
                                    value={typeForm.data.code}
                                    onChange={(e) =>
                                        typeForm.setData(
                                            'code',
                                            e.target.value
                                                .replace(/\D/g, '')
                                                .slice(0, 3),
                                        )
                                    }
                                    inputMode="numeric"
                                    maxLength={3}
                                    autoComplete="off"
                                    className="h-10 tabular-nums"
                                />
                            </FormField>

                            <FormField
                                label="Porcentaje (%)"
                                htmlFor="rate"
                                error={typeErrors.rate}
                                required
                            >
                                <Input
                                    id="rate"
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    inputMode="decimal"
                                    value={typeForm.data.rate}
                                    onChange={(e) =>
                                        typeForm.setData('rate', e.target.value)
                                    }
                                    className="h-10 tabular-nums"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Descripción"
                            htmlFor="description"
                            error={typeErrors.description}
                            required
                        >
                            <Input
                                id="description"
                                value={typeForm.data.description}
                                onChange={(e) =>
                                    typeForm.setData(
                                        'description',
                                        e.target.value,
                                    )
                                }
                                maxLength={150}
                                className="h-10"
                            />
                        </FormField>

                        <div className="grid gap-3">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="is_active"
                                    checked={typeForm.data.is_active}
                                    onCheckedChange={(checked) =>
                                        typeForm.setData(
                                            'is_active',
                                            checked === true,
                                        )
                                    }
                                />
                                <Label
                                    htmlFor="is_active"
                                    className="text-[0.9375rem]"
                                >
                                    Activo (disponible al emitir)
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="is_default"
                                    checked={typeForm.data.is_default}
                                    onCheckedChange={(checked) =>
                                        typeForm.setData(
                                            'is_default',
                                            checked === true,
                                        )
                                    }
                                />
                                <Label
                                    htmlFor="is_default"
                                    className="text-[0.9375rem]"
                                >
                                    Predeterminado (se propone primero en las
                                    facturas)
                                </Label>
                            </div>
                            <InputError
                                message={
                                    typeErrors.is_active ??
                                    typeErrors.is_default
                                }
                            />
                        </div>

                        <InputError message={typeErrors.api} />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={typeForm.processing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={typeForm.processing}
                            >
                                {typeForm.processing && <Spinner />}
                                {editing ? 'Guardar cambios' : 'Agregar tipo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

DetractionPage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: detractionIndex() },
        { title: 'Detracción', href: detractionIndex() },
    ],
};
