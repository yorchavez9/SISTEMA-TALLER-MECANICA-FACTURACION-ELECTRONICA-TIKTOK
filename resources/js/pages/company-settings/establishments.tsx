import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
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
import { Spinner } from '@/components/ui/spinner';
import {
    destroy,
    index as establishmentsIndex,
    store,
    update,
} from '@/routes/company-settings/establishments';

type EstablishmentRow = {
    id: number;
    name: string;
    local_code: string;
    address: string;
    ubigeo: string;
    phone: string | null;
    email: string | null;
    is_main: boolean;
    synced: boolean;
    series_count: number;
};

type Props = {
    establishments: EstablishmentRow[];
    connected: boolean;
};

const EMPTY_FORM = {
    name: '',
    local_code: '',
    address: '',
    ubigeo: '',
    phone: '',
    email: '',
};

export default function EstablishmentsPage({
    establishments,
    connected,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<EstablishmentRow | null>(null);
    const [toDelete, setToDelete] = useState<EstablishmentRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const form = useForm({ ...EMPTY_FORM });
    const errors = form.errors as Record<string, string>;

    const openCreate = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...EMPTY_FORM });
        setDialogOpen(true);
    };

    const openEdit = (row: EstablishmentRow) => {
        setEditing(row);
        form.clearErrors();
        form.setData({
            name: row.name ?? '',
            local_code: row.local_code ?? '',
            address: row.address ?? '',
            ubigeo: row.ubigeo ?? '',
            phone: row.phone ?? '',
            email: row.email ?? '',
        });
        setDialogOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                setEditing(null);
                form.reset();
            },
        };

        if (editing) {
            form.put(update.url(editing.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    const confirmDelete = () => {
        if (!toDelete) {
            return;
        }

        setDeleting(true);
        router.delete(destroy.url(toDelete.id), {
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                setToDelete(null);
            },
        });
    };

    const columns: DataTableColumn<EstablishmentRow>[] = [
        {
            id: 'local_code',
            header: 'Código',
            priority: 'primary',
            cell: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                        {row.local_code}
                    </span>
                    {row.is_main && (
                        <StatusBadge tone="primary">Principal</StatusBadge>
                    )}
                </div>
            ),
        },
        {
            id: 'name',
            header: 'Nombre',
            priority: 'primary',
            cell: (row) => row.name,
        },
        {
            id: 'address',
            header: 'Dirección',
            priority: 'md',
            cell: (row) => row.address,
        },
        {
            id: 'ubigeo',
            header: 'Ubigeo',
            priority: 'lg',
            className: 'tabular-nums',
            cell: (row) => row.ubigeo,
        },
        {
            id: 'series_count',
            header: 'Series',
            priority: 'lg',
            className: 'tabular-nums',
            cell: (row) => row.series_count,
        },
        {
            id: 'synced',
            header: 'API',
            priority: 'lg',
            mobileLabel: 'Sincronizado con la API',
            cell: (row) =>
                row.synced ? (
                    <StatusBadge tone="primary">Sincronizado</StatusBadge>
                ) : (
                    <StatusBadge tone="warning">
                        {connected ? 'Pendiente' : 'Solo local'}
                    </StatusBadge>
                ),
        },
    ];

    const lockCode = editing?.is_main ?? false;

    return (
        <>
            <Head title="Establecimientos" />

            <SectionCard
                title="Establecimientos"
                description="Locales desde los que el taller emite comprobantes. El principal usa el código 0000."
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        Nuevo establecimiento
                    </Button>
                }
                flush
            >
                <div className="p-4">
                    <InputError message={pageErrors.api} className="mb-3" />
                    <ResponsiveDataTable
                        data={establishments}
                        columns={columns}
                        getRowId={(row) => row.id}
                        caption="Establecimientos"
                        actions={(row) => [
                            {
                                label: 'Editar',
                                icon: Pencil,
                                onClick: () => openEdit(row),
                            },
                            {
                                label: 'Eliminar',
                                icon: Trash2,
                                variant: 'destructive',
                                hidden: row.is_main,
                                onClick: () => setToDelete(row),
                            },
                        ]}
                    />
                </div>
            </SectionCard>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => !form.processing && setDialogOpen(open)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                    <form onSubmit={submit} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing
                                    ? 'Editar establecimiento'
                                    : 'Nuevo establecimiento'}
                            </DialogTitle>
                            <DialogDescription>
                                {connected
                                    ? 'Los cambios se envían también a la API de facturación.'
                                    : 'Se guardará localmente y se enviará a la API al registrar el taller.'}
                            </DialogDescription>
                        </DialogHeader>

                        <FormField
                            label="Nombre"
                            htmlFor="name"
                            error={errors.name}
                            required
                        >
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(e) =>
                                    form.setData('name', e.target.value)
                                }
                                maxLength={100}
                                className="h-10"
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Código de establecimiento"
                                htmlFor="local_code"
                                error={errors.local_code}
                                hint={
                                    lockCode
                                        ? 'SUNAT exige 0000 para el principal.'
                                        : '4 dígitos (ej. 0001)'
                                }
                                required
                            >
                                <Input
                                    id="local_code"
                                    value={form.data.local_code}
                                    onChange={(e) =>
                                        form.setData(
                                            'local_code',
                                            e.target.value
                                                .replace(/\D/g, '')
                                                .slice(0, 4),
                                        )
                                    }
                                    disabled={lockCode}
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="0001"
                                    autoComplete="off"
                                    className="h-10 tabular-nums"
                                />
                            </FormField>

                            <FormField
                                label="Ubigeo"
                                htmlFor="ubigeo"
                                error={errors.ubigeo}
                                hint="6 dígitos (ej. 150101)"
                                required
                            >
                                <Input
                                    id="ubigeo"
                                    value={form.data.ubigeo}
                                    onChange={(e) =>
                                        form.setData(
                                            'ubigeo',
                                            e.target.value
                                                .replace(/\D/g, '')
                                                .slice(0, 6),
                                        )
                                    }
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="off"
                                    className="h-10 tabular-nums"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Dirección"
                            htmlFor="address"
                            error={errors.address}
                            required
                        >
                            <Input
                                id="address"
                                value={form.data.address}
                                onChange={(e) =>
                                    form.setData('address', e.target.value)
                                }
                                maxLength={255}
                                className="h-10 uppercase"
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Teléfono"
                                htmlFor="phone"
                                error={errors.phone}
                            >
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) =>
                                        form.setData('phone', e.target.value)
                                    }
                                    maxLength={30}
                                    className="h-10"
                                />
                            </FormField>

                            <FormField
                                label="Correo"
                                htmlFor="email"
                                error={errors.email}
                            >
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) =>
                                        form.setData('email', e.target.value)
                                    }
                                    maxLength={255}
                                    className="h-10"
                                />
                            </FormField>
                        </div>

                        <InputError message={errors.api} />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={form.processing}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                {editing
                                    ? 'Guardar cambios'
                                    : 'Crear establecimiento'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title={`¿Eliminar el establecimiento ${toDelete?.name ?? ''}?`}
                description={
                    connected
                        ? 'Se eliminará también de la API de facturación. Esta acción no se puede deshacer.'
                        : 'Esta acción no se puede deshacer.'
                }
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

EstablishmentsPage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: establishmentsIndex() },
        { title: 'Establecimientos', href: establishmentsIndex() },
    ],
};
