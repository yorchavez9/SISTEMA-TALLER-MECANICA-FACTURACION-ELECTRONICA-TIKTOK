import { Head, router, usePage } from '@inertiajs/react';
import { Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { CustomerFormDialog } from '@/components/catalog/customer-form-dialog';
import type { CustomerRow } from '@/components/catalog/customer-form-dialog';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { useTableFilters } from '@/hooks/use-table-filters';
import { destroy, index as customersIndex, show } from '@/routes/customers';
import type { Option, Paginated } from '@/types';

type Filters = { search: string; document_type: string };

type Props = {
    customers: Paginated<CustomerRow>;
    filters: Filters;
    documentTypes: Option[];
    lookupsAvailable: boolean;
    can: { manage: boolean };
};

const columns: DataTableColumn<CustomerRow>[] = [
    {
        id: 'name',
        header: 'Cliente',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium break-words">{row.name}</p>
                {row.trade_name && (
                    <p className="text-sm break-words text-muted-foreground">
                        {row.trade_name}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'document',
        header: 'Documento',
        priority: 'primary',
        cell: (row) => (
            <span className="tabular-nums">{row.document_label}</span>
        ),
    },
    {
        id: 'phone',
        header: 'Teléfono',
        priority: 'md',
        cell: (row) => <span className="tabular-nums">{row.phone ?? '—'}</span>,
    },
    {
        id: 'vehicles',
        header: 'Vehículos',
        priority: 'lg',
        className: 'tabular-nums',
        cell: (row) => row.vehicles_count ?? 0,
    },
    {
        id: 'email',
        header: 'Correo',
        priority: 'lg',
        cell: (row) => <span className="break-all">{row.email ?? '—'}</span>,
    },
    {
        id: 'address',
        header: 'Dirección',
        priority: 'lg',
        cell: (row) => (
            <span className="line-clamp-2 break-words">
                {row.address ?? '—'}
            </span>
        ),
    },
];

export default function CustomersIndex({
    customers,
    filters,
    documentTypes,
    lookupsAvailable,
    can,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const applyFilters = useTableFilters(customersIndex.url(), filters);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<CustomerRow | null>(null);
    const [toDelete, setToDelete] = useState<CustomerRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const filtered = !!filters.search || !!filters.document_type;

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: CustomerRow) => {
        setEditing(row);
        setDialogOpen(true);
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

    return (
        <>
            <Head title="Clientes" />

            <PageContainer>
                <PageHeader
                    title="Clientes"
                    description="Personas y empresas que atiende el taller."
                    actions={
                        can.manage && (
                            <Button onClick={openCreate}>
                                <Plus />
                                Nuevo cliente
                            </Button>
                        )
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Nombre, documento o teléfono"
                    activeFilters={filters.document_type ? 1 : 0}
                    filters={
                        <SelectInput
                            id="document-type-filter"
                            value={filters.document_type || 'all'}
                            onChange={(value) =>
                                applyFilters({
                                    document_type: value === 'all' ? '' : value,
                                })
                            }
                            options={[
                                { value: 'all', label: 'Todos los documentos' },
                                ...documentTypes,
                            ]}
                            className="md:w-56"
                        />
                    }
                />

                <InputError message={pageErrors.api} />

                <ResponsiveDataTable
                    data={customers.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Clientes"
                    actions={(row) => [
                        { label: 'Ver', icon: Eye, href: show(row.id) },
                        {
                            label: 'Editar',
                            icon: Pencil,
                            onClick: () => openEdit(row),
                            hidden: !can.manage,
                        },
                        {
                            label: 'Eliminar',
                            icon: Trash2,
                            variant: 'destructive',
                            onClick: () => setToDelete(row),
                            hidden: !can.manage,
                        },
                    ]}
                    emptyState={
                        <EmptyState
                            icon={Users}
                            title={
                                filtered
                                    ? 'Sin resultados'
                                    : 'Aún no hay clientes'
                            }
                            description={
                                filtered
                                    ? 'Pruebe con otros términos o filtros de búsqueda.'
                                    : 'Registre a sus clientes para asociarles vehículos y emitir comprobantes.'
                            }
                            action={
                                !filtered &&
                                can.manage && (
                                    <Button onClick={openCreate}>
                                        <Plus />
                                        Nuevo cliente
                                    </Button>
                                )
                            }
                        />
                    }
                />

                <DataTablePagination paginator={customers} />
            </PageContainer>

            {can.manage && (
                <CustomerFormDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    customer={editing}
                    documentTypes={documentTypes}
                    lookupsAvailable={lookupsAvailable}
                />
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title={`¿Eliminar a ${toDelete?.name ?? 'este cliente'}?`}
                description="El cliente dejará de aparecer en los listados. No se puede eliminar si tiene vehículos registrados."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

CustomersIndex.layout = {
    breadcrumbs: [{ title: 'Clientes', href: customersIndex() }],
};
