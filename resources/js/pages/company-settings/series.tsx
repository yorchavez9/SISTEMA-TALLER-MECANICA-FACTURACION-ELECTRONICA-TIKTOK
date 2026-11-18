import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Plus, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
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
import { Spinner } from '@/components/ui/spinner';
import {
    index as seriesIndex,
    store,
    update,
} from '@/routes/company-settings/series';
import type { Option } from '@/types';

type SeriesRow = {
    id: number;
    document_type: string;
    document_type_label: string;
    series: string;
    initial_number: number;
    last_number: number;
    is_active: boolean;
    synced: boolean;
    establishment: string | null;
};

type Props = {
    series: SeriesRow[];
    establishments: Option[];
    documentTypes: Option[];
    connected: boolean;
};

const PLACEHOLDERS: Record<string, string> = {
    '01': 'F001',
    '03': 'B001',
    '07': 'FC01',
    '08': 'FD01',
};

export default function SeriesPage({
    series,
    establishments,
    documentTypes,
    connected,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const [createOpen, setCreateOpen] = useState(false);
    const [toToggle, setToToggle] = useState<SeriesRow | null>(null);
    const [toggling, setToggling] = useState(false);

    const form = useForm({
        document_type: '01',
        series: '',
        establishment_id: establishments[0]?.value ?? '',
        initial_number: '0',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setCreateOpen(false);
            },
        });
    };

    const confirmToggle = () => {
        if (!toToggle) {
            return;
        }

        setToggling(true);
        router.patch(
            update.url(toToggle.id),
            { is_active: !toToggle.is_active },
            {
                preserveScroll: true,
                onFinish: () => {
                    setToggling(false);
                    setToToggle(null);
                },
            },
        );
    };

    const columns: DataTableColumn<SeriesRow>[] = [
        {
            id: 'series',
            header: 'Serie',
            priority: 'primary',
            cell: (row) => (
                <span className="font-medium tabular-nums">{row.series}</span>
            ),
        },
        {
            id: 'type',
            header: 'Comprobante',
            priority: 'primary',
            cell: (row) => row.document_type_label,
        },
        {
            id: 'status',
            header: 'Estado',
            priority: 'md',
            cell: (row) => (
                <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Activa' : 'Inactiva'}
                </StatusBadge>
            ),
        },
        {
            id: 'establishment',
            header: 'Establecimiento',
            priority: 'lg',
            cell: (row) => row.establishment ?? '—',
        },
        {
            id: 'last_number',
            header: 'Último correlativo',
            priority: 'lg',
            className: 'tabular-nums',
            cell: (row) => row.last_number,
        },
        {
            id: 'synced',
            header: 'API',
            priority: 'lg',
            mobileLabel: 'Sincronizada con la API',
            cell: (row) =>
                row.synced ? (
                    <StatusBadge tone="primary">Sincronizada</StatusBadge>
                ) : (
                    <StatusBadge tone="warning">
                        {connected ? 'Pendiente' : 'Solo local'}
                    </StatusBadge>
                ),
        },
    ];

    return (
        <>
            <Head title="Series de comprobantes" />

            <SectionCard
                title="Series de comprobantes"
                description="Las series no se eliminan: se desactivan. Los correlativos los controla el sistema al emitir."
                action={
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus />
                        Nueva serie
                    </Button>
                }
                flush
            >
                <div className="p-4">
                    <InputError message={pageErrors.api} className="mb-3" />
                    <ResponsiveDataTable
                        data={series}
                        columns={columns}
                        getRowId={(row) => row.id}
                        caption="Series de comprobantes"
                        actions={(row) => [
                            {
                                label: row.is_active ? 'Desactivar' : 'Activar',
                                icon: row.is_active ? PowerOff : Power,
                                variant: row.is_active
                                    ? 'destructive'
                                    : 'default',
                                onClick: () => setToToggle(row),
                            },
                        ]}
                    />
                </div>
            </SectionCard>

            <Dialog
                open={createOpen}
                onOpenChange={(open) => !form.processing && setCreateOpen(open)}
            >
                <DialogContent className="sm:max-w-lg">
                    <form onSubmit={submit} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>Nueva serie</DialogTitle>
                            <DialogDescription>
                                {connected
                                    ? 'Se creará también en la API de facturación.'
                                    : 'Se guardará localmente y se enviará a la API al registrar el taller.'}
                            </DialogDescription>
                        </DialogHeader>

                        <FormField
                            label="Tipo de comprobante"
                            htmlFor="document_type"
                            error={form.errors.document_type}
                            required
                        >
                            <SelectInput
                                id="document_type"
                                value={form.data.document_type}
                                onChange={(value) =>
                                    form.setData('document_type', value)
                                }
                                options={documentTypes}
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Serie"
                                htmlFor="series"
                                error={form.errors.series}
                                hint="4 caracteres"
                                required
                            >
                                <Input
                                    id="series"
                                    value={form.data.series}
                                    onChange={(e) =>
                                        form.setData(
                                            'series',
                                            e.target.value
                                                .toUpperCase()
                                                .slice(0, 4),
                                        )
                                    }
                                    placeholder={
                                        PLACEHOLDERS[form.data.document_type]
                                    }
                                    className="h-10 uppercase tabular-nums"
                                    maxLength={4}
                                    autoComplete="off"
                                />
                            </FormField>

                            <FormField
                                label="Correlativo inicial"
                                htmlFor="initial_number"
                                error={form.errors.initial_number}
                                hint="Normalmente 0"
                            >
                                <Input
                                    id="initial_number"
                                    type="number"
                                    min={0}
                                    value={form.data.initial_number}
                                    onChange={(e) =>
                                        form.setData(
                                            'initial_number',
                                            e.target.value,
                                        )
                                    }
                                    className="h-10 tabular-nums"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Establecimiento"
                            htmlFor="establishment_id"
                            error={form.errors.establishment_id}
                            required
                        >
                            <SelectInput
                                id="establishment_id"
                                value={form.data.establishment_id}
                                onChange={(value) =>
                                    form.setData('establishment_id', value)
                                }
                                options={establishments}
                            />
                        </FormField>

                        <InputError
                            message={
                                (form.errors as Record<string, string>).api
                            }
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={form.processing}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                Crear serie
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={toToggle !== null}
                onOpenChange={(open) => !open && setToToggle(null)}
                title={
                    toToggle?.is_active
                        ? `¿Desactivar la serie ${toToggle?.series}?`
                        : `¿Activar la serie ${toToggle?.series}?`
                }
                description={
                    toToggle?.is_active
                        ? 'No se podrán emitir comprobantes con esta serie hasta volver a activarla.'
                        : 'La serie volverá a estar disponible para emitir comprobantes.'
                }
                confirmLabel={toToggle?.is_active ? 'Desactivar' : 'Activar'}
                variant={toToggle?.is_active ? 'destructive' : 'default'}
                processing={toggling}
                onConfirm={confirmToggle}
            />
        </>
    );
}

SeriesPage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: seriesIndex() },
        { title: 'Series', href: seriesIndex() },
    ],
};
