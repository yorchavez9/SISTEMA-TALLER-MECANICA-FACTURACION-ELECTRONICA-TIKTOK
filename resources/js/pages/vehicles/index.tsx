import { Head, Link, router, usePage } from '@inertiajs/react';
import { Car, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { VehicleFormDialog } from '@/components/catalog/vehicle-form-dialog';
import type { VehicleRow } from '@/components/catalog/vehicle-form-dialog';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { useTableFilters } from '@/hooks/use-table-filters';
import { show as customersShow } from '@/routes/customers';
import { destroy, index as vehiclesIndex } from '@/routes/vehicles';
import type { Paginated } from '@/types';

type Props = {
    vehicles: Paginated<VehicleRow>;
    filters: { search: string };
    can: { manage: boolean };
};

const kmFormat = new Intl.NumberFormat('es-PE');

const columns: DataTableColumn<VehicleRow>[] = [
    {
        id: 'plate',
        header: 'Placa',
        priority: 'primary',
        cell: (row) => (
            <span className="font-semibold whitespace-nowrap tabular-nums">
                {row.plate_display}
            </span>
        ),
    },
    {
        id: 'vehicle',
        header: 'Vehículo',
        priority: 'primary',
        cell: (row) => (
            <span className="break-words">
                {row.brand} {row.model}
            </span>
        ),
    },
    {
        id: 'customer',
        header: 'Cliente',
        priority: 'md',
        cell: (row) =>
            row.customer ? (
                <div className="min-w-0">
                    <Link
                        href={customersShow(row.customer.id)}
                        className="font-medium break-words underline-offset-4 hover:underline"
                    >
                        {row.customer.name}
                    </Link>
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {row.customer.document}
                    </p>
                </div>
            ) : (
                '—'
            ),
    },
    {
        id: 'year',
        header: 'Año',
        priority: 'lg',
        className: 'tabular-nums',
        cell: (row) => row.year ?? '—',
    },
    {
        id: 'mileage',
        header: 'Kilometraje',
        priority: 'lg',
        className: 'tabular-nums',
        cell: (row) => `${kmFormat.format(row.current_mileage ?? 0)} km`,
    },
    {
        id: 'color',
        header: 'Color',
        priority: 'lg',
        cell: (row) => row.color ?? '—',
    },
];

export default function VehiclesIndex({ vehicles, filters, can }: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const applyFilters = useTableFilters(vehiclesIndex.url(), filters);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<VehicleRow | null>(null);
    const [toDelete, setToDelete] = useState<VehicleRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const openCreate = () => {
        setEditing(null);
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
            <Head title="Vehículos" />

            <PageContainer>
                <PageHeader
                    title="Vehículos"
                    description="Vehículos registrados de sus clientes."
                    actions={
                        can.manage && (
                            <Button onClick={openCreate}>
                                <Plus />
                                Nuevo vehículo
                            </Button>
                        )
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Placa, marca, modelo o cliente"
                />

                <InputError message={pageErrors.api} />

                <ResponsiveDataTable
                    data={vehicles.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Vehículos"
                    actions={(row) => [
                        {
                            label: 'Ver cliente',
                            icon: UserRound,
                            href: customersShow(row.customer_id),
                        },
                        {
                            label: 'Editar',
                            icon: Pencil,
                            onClick: () => {
                                setEditing(row);
                                setDialogOpen(true);
                            },
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
                            icon={Car}
                            title={
                                filters.search
                                    ? 'Sin resultados'
                                    : 'Aún no hay vehículos'
                            }
                            description={
                                filters.search
                                    ? 'Pruebe con otros términos de búsqueda.'
                                    : 'Registre los vehículos de sus clientes para asociarlos a las órdenes de trabajo.'
                            }
                            action={
                                !filters.search &&
                                can.manage && (
                                    <Button onClick={openCreate}>
                                        <Plus />
                                        Nuevo vehículo
                                    </Button>
                                )
                            }
                        />
                    }
                />

                <DataTablePagination paginator={vehicles} />
            </PageContainer>

            {can.manage && (
                <VehicleFormDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    vehicle={editing}
                />
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title={`¿Eliminar el vehículo ${toDelete?.plate_display ?? ''}?`}
                description="El vehículo dejará de aparecer en los listados y en la ficha del cliente."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

VehiclesIndex.layout = {
    breadcrumbs: [{ title: 'Vehículos', href: vehiclesIndex() }],
};
