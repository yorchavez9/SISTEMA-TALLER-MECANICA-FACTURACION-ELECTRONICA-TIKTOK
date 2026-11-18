import { Head, Link, router, usePage } from '@inertiajs/react';
import { Car, ClipboardPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { CustomerFormDialog } from '@/components/catalog/customer-form-dialog';
import type { CustomerRow } from '@/components/catalog/customer-form-dialog';
import { VehicleFormDialog } from '@/components/catalog/vehicle-form-dialog';
import type { VehicleRow } from '@/components/catalog/vehicle-form-dialog';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { formatDateTime } from '@/lib/format';
import {
    destroy as customersDestroy,
    index as customersIndex,
    show as customersShow,
} from '@/routes/customers';
import { destroy as vehiclesDestroy } from '@/routes/vehicles';
import { create as workOrdersCreate } from '@/routes/work-orders';
import type { Option } from '@/types';

type Props = {
    customer: CustomerRow & { notes: string | null; created_at: string | null };
    vehicles: VehicleRow[];
    documentTypes: Option[];
    lookupsAvailable: boolean;
    can: { manage: boolean; manageVehicles: boolean };
};

const kmFormat = new Intl.NumberFormat('es-PE');

const vehicleColumns: DataTableColumn<VehicleRow>[] = [
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
                {[row.brand, row.model, row.year].filter(Boolean).join(' ')}
            </span>
        ),
    },
    {
        id: 'mileage',
        header: 'Kilometraje',
        priority: 'md',
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

function DetailItem({
    label,
    children,
    wide,
}: {
    label: string;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-[0.9375rem] break-words">
                {children || '—'}
            </dd>
        </div>
    );
}

export default function CustomerShow({
    customer,
    vehicles,
    documentTypes,
    lookupsAvailable,
    can,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };

    const canCreateOrders = useCan()('work_orders.manage');

    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletingCustomer, setDeletingCustomer] = useState(false);

    const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(
        null,
    );
    const [vehicleToDelete, setVehicleToDelete] = useState<VehicleRow | null>(
        null,
    );
    const [deletingVehicle, setDeletingVehicle] = useState(false);

    const fixedCustomer = {
        id: customer.id,
        name: customer.name,
        document: customer.document_label,
    };

    const confirmDeleteCustomer = () => {
        setDeletingCustomer(true);
        router.delete(customersDestroy.url(customer.id), {
            preserveScroll: true,
            onFinish: () => {
                setDeletingCustomer(false);
                setDeleteOpen(false);
            },
        });
    };

    const confirmDeleteVehicle = () => {
        if (!vehicleToDelete) {
            return;
        }

        setDeletingVehicle(true);
        router.delete(vehiclesDestroy.url(vehicleToDelete.id), {
            preserveScroll: true,
            onFinish: () => {
                setDeletingVehicle(false);
                setVehicleToDelete(null);
            },
        });
    };

    const openCreateVehicle = () => {
        setEditingVehicle(null);
        setVehicleDialogOpen(true);
    };

    return (
        <>
            <Head title={customer.name} />

            <PageContainer>
                <PageHeader
                    title={customer.name}
                    description={customer.document_label}
                    actions={
                        (canCreateOrders || can.manage) && (
                            <>
                                {canCreateOrders && (
                                    <Button asChild>
                                        <Link
                                            href={workOrdersCreate({
                                                query: {
                                                    customer: customer.id,
                                                },
                                            })}
                                        >
                                            <ClipboardPlus />
                                            Nueva orden
                                        </Link>
                                    </Button>
                                )}
                                {can.manage && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => setEditOpen(true)}
                                        >
                                            <Pencil />
                                            Editar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setDeleteOpen(true)}
                                        >
                                            <Trash2 />
                                            Eliminar
                                        </Button>
                                    </>
                                )}
                            </>
                        )
                    }
                />

                <InputError message={pageErrors.api} />

                <SectionCard title="Datos del cliente">
                    <dl className="grid gap-5 sm:grid-cols-2">
                        <DetailItem label="Nombre o razón social">
                            {customer.name}
                        </DetailItem>
                        <DetailItem label="Documento">
                            <span className="tabular-nums">
                                {customer.document_label}
                            </span>
                        </DetailItem>
                        {customer.trade_name && (
                            <DetailItem label="Nombre comercial" wide>
                                {customer.trade_name}
                            </DetailItem>
                        )}
                        <DetailItem label="Teléfono">
                            {customer.phone && (
                                <span className="tabular-nums">
                                    {customer.phone}
                                </span>
                            )}
                        </DetailItem>
                        <DetailItem label="Correo">
                            {customer.email && (
                                <span className="break-all">
                                    {customer.email}
                                </span>
                            )}
                        </DetailItem>
                        <DetailItem label="Dirección" wide>
                            {customer.address}
                        </DetailItem>
                        {customer.notes && (
                            <DetailItem label="Notas" wide>
                                <span className="whitespace-pre-line">
                                    {customer.notes}
                                </span>
                            </DetailItem>
                        )}
                        <DetailItem label="Registrado">
                            {customer.created_at &&
                                formatDateTime(customer.created_at)}
                        </DetailItem>
                    </dl>
                </SectionCard>

                <SectionCard
                    title="Vehículos"
                    description={
                        vehicles.length === 1
                            ? '1 vehículo registrado.'
                            : `${vehicles.length} vehículos registrados.`
                    }
                    action={
                        can.manageVehicles && (
                            <Button onClick={openCreateVehicle}>
                                <Plus />
                                Agregar vehículo
                            </Button>
                        )
                    }
                    flush
                >
                    <div className="grid gap-3 p-4">
                        <ResponsiveDataTable
                            data={vehicles}
                            columns={vehicleColumns}
                            getRowId={(row) => row.id}
                            caption={`Vehículos de ${customer.name}`}
                            actions={
                                can.manageVehicles || canCreateOrders
                                    ? (row) => [
                                          {
                                              label: 'Nueva orden',
                                              icon: ClipboardPlus,
                                              href: workOrdersCreate({
                                                  query: { vehicle: row.id },
                                              }),
                                              hidden: !canCreateOrders,
                                          },
                                          {
                                              label: 'Editar',
                                              icon: Pencil,
                                              onClick: () => {
                                                  setEditingVehicle(row);
                                                  setVehicleDialogOpen(true);
                                              },
                                              hidden: !can.manageVehicles,
                                          },
                                          {
                                              label: 'Eliminar',
                                              icon: Trash2,
                                              variant: 'destructive',
                                              onClick: () =>
                                                  setVehicleToDelete(row),
                                              hidden: !can.manageVehicles,
                                          },
                                      ]
                                    : undefined
                            }
                            emptyState={
                                <EmptyState
                                    icon={Car}
                                    title="Sin vehículos"
                                    description="Este cliente aún no tiene vehículos registrados."
                                    action={
                                        can.manageVehicles && (
                                            <Button
                                                variant="outline"
                                                onClick={openCreateVehicle}
                                            >
                                                <Plus />
                                                Agregar vehículo
                                            </Button>
                                        )
                                    }
                                />
                            }
                        />
                        <p className="text-sm text-muted-foreground">
                            Use “Nueva orden” en un vehículo para registrar su
                            ingreso al taller. El historial completo por
                            vehículo se incorpora con los reportes.
                        </p>
                    </div>
                </SectionCard>
            </PageContainer>

            {can.manage && (
                <CustomerFormDialog
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    customer={customer}
                    documentTypes={documentTypes}
                    lookupsAvailable={lookupsAvailable}
                />
            )}

            {can.manageVehicles && (
                <VehicleFormDialog
                    open={vehicleDialogOpen}
                    onOpenChange={setVehicleDialogOpen}
                    vehicle={editingVehicle}
                    fixedCustomer={fixedCustomer}
                />
            )}

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`¿Eliminar a ${customer.name}?`}
                description={
                    vehicles.length > 0
                        ? 'Este cliente tiene vehículos registrados. Elimine o reasigne sus vehículos antes de eliminarlo.'
                        : 'El cliente dejará de aparecer en los listados.'
                }
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deletingCustomer}
                onConfirm={confirmDeleteCustomer}
            />

            <ConfirmDialog
                open={vehicleToDelete !== null}
                onOpenChange={(open) => !open && setVehicleToDelete(null)}
                title={`¿Eliminar el vehículo ${vehicleToDelete?.plate_display ?? ''}?`}
                description="El vehículo dejará de aparecer en la ficha del cliente."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deletingVehicle}
                onConfirm={confirmDeleteVehicle}
            />
        </>
    );
}

CustomerShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Clientes', href: customersIndex() },
        { title: props.customer.name, href: customersShow(props.customer.id) },
    ],
});
