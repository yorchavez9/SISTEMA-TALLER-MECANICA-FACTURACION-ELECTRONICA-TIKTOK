import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { ServiceFormDialog } from '@/components/catalog/service-form-dialog';
import type { ServiceRow } from '@/components/catalog/service-form-dialog';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatMoney } from '@/lib/format';
import { destroy, index as servicesIndex } from '@/routes/services';
import type { Option, Paginated } from '@/types';

type Filters = { search: string; status: '' | 'active' | 'inactive' };

type Props = {
    services: Paginated<ServiceRow>;
    filters: Filters;
    igvAffectations: Option[];
    detractionTypes: Option[];
    can: { manage: boolean };
};

const STATUS_OPTIONS: Option[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
];

const columns: DataTableColumn<ServiceRow>[] = [
    {
        id: 'name',
        header: 'Servicio',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium break-words">{row.name}</p>
                {row.description && (
                    <p className="truncate text-sm text-muted-foreground">
                        {row.description}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'price',
        header: 'Precio',
        priority: 'primary',
        className: 'w-[34%] text-right tabular-nums md:w-36',
        cell: (row) => (
            <span className="whitespace-nowrap">{formatMoney(row.price)}</span>
        ),
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
        id: 'detraction',
        header: 'Detracción',
        priority: 'lg',
        cell: (row) =>
            row.subject_to_detraction
                ? (row.detraction_label ?? 'Predeterminado')
                : 'No',
    },
    {
        id: 'igv',
        header: 'IGV',
        priority: 'lg',
        cell: (row) => row.igv_affectation_label,
    },
];

export default function ServicesIndex({
    services,
    filters,
    igvAffectations,
    detractionTypes,
    can,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const applyFilters = useTableFilters(servicesIndex.url(), filters);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ServiceRow | null>(null);
    const [toDelete, setToDelete] = useState<ServiceRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row: ServiceRow) => {
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

    const hasFilters = !!filters.search || !!filters.status;

    return (
        <>
            <Head title="Servicios" />

            <PageContainer>
                <PageHeader
                    title="Servicios"
                    description="Mano de obra y servicios que ofrece el taller. Los precios incluyen IGV."
                    actions={
                        can.manage && (
                            <Button onClick={openCreate}>
                                <Plus />
                                Nuevo servicio
                            </Button>
                        )
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Buscar por nombre"
                    activeFilters={filters.status ? 1 : 0}
                    filters={
                        <SelectInput
                            id="status-filter"
                            value={filters.status || 'all'}
                            onChange={(value) =>
                                applyFilters({
                                    status:
                                        value === 'all'
                                            ? ''
                                            : (value as Filters['status']),
                                })
                            }
                            options={STATUS_OPTIONS}
                            className="md:w-44"
                        />
                    }
                />

                <InputError message={pageErrors.api} />

                <ResponsiveDataTable
                    data={services.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Servicios"
                    actions={
                        can.manage
                            ? (row) => [
                                  {
                                      label: 'Editar',
                                      icon: Pencil,
                                      onClick: () => openEdit(row),
                                  },
                                  {
                                      label: 'Eliminar',
                                      icon: Trash2,
                                      variant: 'destructive',
                                      onClick: () => setToDelete(row),
                                  },
                              ]
                            : undefined
                    }
                    emptyState={
                        <EmptyState
                            icon={Wrench}
                            title={
                                hasFilters
                                    ? 'Sin resultados'
                                    : 'Aún no hay servicios'
                            }
                            description={
                                hasFilters
                                    ? 'Pruebe con otros términos de búsqueda o filtros.'
                                    : 'Registre los servicios que ofrece el taller para usarlos en órdenes y ventas.'
                            }
                            action={
                                !hasFilters &&
                                can.manage && (
                                    <Button onClick={openCreate}>
                                        <Plus />
                                        Nuevo servicio
                                    </Button>
                                )
                            }
                        />
                    }
                />

                <DataTablePagination paginator={services} />
            </PageContainer>

            {can.manage && (
                <ServiceFormDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    service={editing}
                    igvAffectations={igvAffectations}
                    detractionTypes={detractionTypes}
                />
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title={`¿Eliminar el servicio ${toDelete?.name ?? ''}?`}
                description="El servicio dejará de estar disponible. Los comprobantes ya emitidos no se modifican."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ServicesIndex.layout = {
    breadcrumbs: [{ title: 'Servicios', href: servicesIndex() }],
};
