import { router } from '@inertiajs/react';
import { Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { Button } from '@/components/ui/button';
import { formatMoney, formatQuantity } from '@/lib/format';
import { destroy as destroyItem } from '@/routes/work-orders/items';
import { AddItemDialog } from './add-item-dialog';
import { EditItemDialog } from './edit-item-dialog';
import type { WorkOrderDetail, WorkOrderItemRow } from './types';

type Props = {
    order: WorkOrderDetail;
    items: WorkOrderItemRow[];
    canEdit: boolean;
};

const columns: DataTableColumn<WorkOrderItemRow>[] = [
    {
        id: 'description',
        header: 'Descripción',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0 space-y-1">
                <p className="font-medium break-words">{row.description}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm text-muted-foreground">
                        {row.type_label}
                    </span>
                    {row.stock_warning && (
                        <StatusBadge tone="warning">
                            Stock: {formatQuantity(row.stock_available)}
                        </StatusBadge>
                    )}
                </div>
            </div>
        ),
    },
    {
        id: 'total',
        header: 'Importe',
        priority: 'primary',
        className: 'w-28 text-right tabular-nums',
        cell: (row) => (
            <span className="font-medium whitespace-nowrap">
                {formatMoney(row.total)}
            </span>
        ),
    },
    {
        id: 'quantity',
        header: 'Cant.',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatQuantity(row.quantity)} {row.unit}
            </span>
        ),
    },
    {
        id: 'unit_price',
        header: 'P. unit.',
        priority: 'md',
        className: 'text-right tabular-nums',
        mobileLabel: 'Precio unitario',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatMoney(row.unit_price)}
            </span>
        ),
    },
    {
        id: 'subtotal',
        header: 'Subtotal',
        priority: 'lg',
        className: 'text-right tabular-nums',
        mobileLabel: 'Valor (sin IGV)',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatMoney(row.subtotal)}
            </span>
        ),
    },
    {
        id: 'igv',
        header: 'IGV',
        priority: 'lg',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">{formatMoney(row.igv)}</span>
        ),
    },
];

/**
 * Servicios, repuestos y mano de obra de la OT con sus totales.
 */
export function ItemsEditor({ order, items, canEdit }: Props) {
    const [addOpen, setAddOpen] = useState(false);
    const [editing, setEditing] = useState<WorkOrderItemRow | null>(null);
    const [removing, setRemoving] = useState<WorkOrderItemRow | null>(null);
    const [processing, setProcessing] = useState(false);

    const confirmRemove = () => {
        if (!removing) {
            return;
        }

        setProcessing(true);
        router.delete(
            destroyItem.url({ workOrder: order.id, item: removing.id }),
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessing(false);
                    setRemoving(null);
                },
            },
        );
    };

    const addButton = canEdit ? (
        <Button
            className="h-10 w-full sm:w-auto"
            onClick={() => setAddOpen(true)}
        >
            <Plus />
            Agregar
        </Button>
    ) : undefined;

    return (
        <>
            <SectionCard
                title="Servicios, repuestos y mano de obra"
                action={addButton}
                flush
            >
                <div className="grid gap-4 p-4">
                    <ResponsiveDataTable
                        data={items}
                        columns={columns}
                        getRowId={(row) => row.id}
                        caption="Ítems de la orden de trabajo"
                        actions={
                            canEdit
                                ? (row) => [
                                      {
                                          label: 'Editar',
                                          icon: Pencil,
                                          onClick: () => setEditing(row),
                                      },
                                      {
                                          label: 'Quitar',
                                          icon: Trash2,
                                          variant: 'destructive',
                                          onClick: () => setRemoving(row),
                                      },
                                  ]
                                : undefined
                        }
                        emptyState={
                            <EmptyState
                                icon={Wrench}
                                title="Sin ítems"
                                description={
                                    canEdit
                                        ? 'Agregue los servicios, repuestos y mano de obra de esta orden.'
                                        : 'Esta orden no tiene servicios ni repuestos registrados.'
                                }
                            />
                        }
                    />

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-start">
                        <p className="order-last text-sm text-muted-foreground sm:order-first">
                            Precios con IGV incluido. El stock de repuestos se
                            descuenta al registrar la venta.
                        </p>
                        <dl className="grid gap-1.5 text-[0.9375rem]">
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                    Op. gravada
                                </dt>
                                <dd className="tabular-nums">
                                    {formatMoney(order.subtotal)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">IGV</dt>
                                <dd className="tabular-nums">
                                    {formatMoney(order.igv)}
                                </dd>
                            </div>
                            <div className="mt-1 flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                                <dt>Total</dt>
                                <dd className="tabular-nums">
                                    {formatMoney(order.total)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </SectionCard>

            {canEdit && (
                <>
                    <AddItemDialog
                        orderId={order.id}
                        open={addOpen}
                        onOpenChange={setAddOpen}
                    />
                    <EditItemDialog
                        orderId={order.id}
                        item={editing}
                        onClose={() => setEditing(null)}
                    />
                    <ConfirmDialog
                        open={removing !== null}
                        onOpenChange={(open) => !open && setRemoving(null)}
                        title="¿Quitar este ítem?"
                        description={
                            removing
                                ? `"${removing.description}" se quitará de la orden ${order.code} y se recalcularán los totales.`
                                : undefined
                        }
                        confirmLabel="Quitar"
                        variant="destructive"
                        processing={processing}
                        onConfirm={confirmRemove}
                    />
                </>
            )}
        </>
    );
}
