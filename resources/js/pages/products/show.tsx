import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    History,
    Pencil,
    Trash2,
    TriangleAlert,
    Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { ProductStockDialog } from '@/components/catalog/product-stock-dialog';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import InputError from '@/components/input-error';
import { ProductThumbnail } from '@/components/media/product-thumbnail';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { destroy, edit, index as productsIndex, show } from '@/routes/products';
import type { Paginated } from '@/types';
import type { ProductRow } from './index';

type ProductDetail = ProductRow & {
    description: string | null;
    image_url: string | null;
    created_at: string | null;
};

type MovementRow = {
    id: number;
    type: 'in' | 'out' | 'adjust' | 'return';
    type_label: string;
    quantity: string;
    balance_after: string;
    reason: string | null;
    user: string | null;
    created_at: string;
};

type Props = {
    product: ProductDetail;
    movements: Paginated<MovementRow>;
    can: { manage: boolean; adjustStock: boolean };
};

const IGV_LABELS: Record<string, string> = {
    '10': 'Gravado (IGV)',
    '20': 'Exonerado',
    '30': 'Inafecto',
};

const signedQuantity = (value: string): string => {
    const n = Number(value);

    return n > 0 ? `+${formatQuantity(n)}` : formatQuantity(n);
};

const columns: DataTableColumn<MovementRow>[] = [
    {
        id: 'created_at',
        header: 'Fecha',
        priority: 'primary',
        className: 'w-[40%] md:w-44',
        cell: (row) => (
            <span className="text-sm tabular-nums">
                {formatDateTime(row.created_at)}
            </span>
        ),
    },
    {
        id: 'movement',
        header: 'Movimiento',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium">{row.type_label}</p>
                {row.reason && (
                    <p className="text-sm break-words text-muted-foreground">
                        {row.reason}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'quantity',
        header: 'Cantidad',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => {
            const n = Number(row.quantity);

            return (
                <span
                    className={cn(
                        'font-medium whitespace-nowrap',
                        n > 0 && 'text-success-foreground',
                        n < 0 && 'text-destructive-foreground',
                    )}
                >
                    {signedQuantity(row.quantity)}
                </span>
            );
        },
    },
    {
        id: 'balance_after',
        header: 'Saldo',
        priority: 'lg',
        className: 'text-right tabular-nums',
        cell: (row) => formatQuantity(row.balance_after),
    },
    {
        id: 'user',
        header: 'Usuario',
        priority: 'lg',
        cell: (row) =>
            row.user ?? <span className="text-muted-foreground">Sistema</span>,
    },
];

function DataItem({
    label,
    children,
    className,
}: {
    label: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-[0.9375rem] break-words">{children}</dd>
        </div>
    );
}

export default function ProductShow({ product, movements, can }: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const [stockOpen, setStockOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const salePrice = Number(product.sale_price);
    const cost = Number(product.cost);
    const hasMargin = cost > 0 && salePrice > 0;
    const margin = salePrice - cost;
    const marginPercent = hasMargin ? (margin / salePrice) * 100 : 0;

    const confirmDelete = () => {
        setDeleting(true);
        router.delete(destroy.url(product.id), {
            onFinish: () => {
                setDeleting(false);
                setDeleteOpen(false);
            },
        });
    };

    return (
        <>
            <Head title={product.name} />

            <PageContainer>
                <PageHeader
                    title={product.name}
                    description={
                        <span className="tabular-nums">{product.code}</span>
                    }
                    actions={
                        <>
                            {can.manage && (
                                <Button variant="outline" asChild>
                                    <Link href={edit(product.id)}>
                                        <Pencil />
                                        Editar
                                    </Link>
                                </Button>
                            )}
                            {can.adjustStock && (
                                <Button onClick={() => setStockOpen(true)}>
                                    <Warehouse />
                                    Ajustar stock
                                </Button>
                            )}
                            {can.manage && (
                                <Button
                                    variant="outline"
                                    className="text-destructive-foreground"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 />
                                    Eliminar
                                </Button>
                            )}
                        </>
                    }
                />

                <InputError message={pageErrors.api} />

                <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
                    <SectionCard title="Datos del producto">
                        <div className="grid gap-5">
                            <ProductThumbnail
                                src={product.image_url}
                                alt={product.name}
                                className="size-40 sm:size-48"
                                iconClassName="size-10"
                            />

                            {product.is_low_stock && (
                                <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
                                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                                    El stock está en o por debajo del mínimo (
                                    {formatQuantity(product.min_stock)}{' '}
                                    {product.unit}).
                                </p>
                            )}

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                                <DataItem label="Precio (con IGV)">
                                    <span className="font-medium tabular-nums">
                                        {formatMoney(product.sale_price)}
                                    </span>
                                </DataItem>
                                <DataItem label="Costo">
                                    <span className="tabular-nums">
                                        {formatMoney(product.cost)}
                                    </span>
                                </DataItem>
                                <DataItem label="Margen">
                                    {hasMargin ? (
                                        <span
                                            className={cn(
                                                'tabular-nums',
                                                margin < 0 &&
                                                    'text-destructive-foreground',
                                            )}
                                        >
                                            {formatMoney(margin)} (
                                            {marginPercent.toLocaleString(
                                                'es-PE',
                                                { maximumFractionDigits: 1 },
                                            )}{' '}
                                            %)
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </DataItem>
                                <DataItem label="Stock">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium tabular-nums">
                                            {formatQuantity(product.stock)}{' '}
                                            {product.unit}
                                        </span>
                                        {product.is_low_stock && (
                                            <StatusBadge tone="warning">
                                                Stock bajo
                                            </StatusBadge>
                                        )}
                                    </span>
                                </DataItem>
                                <DataItem label="Stock mínimo">
                                    <span className="tabular-nums">
                                        {product.min_stock !== null
                                            ? `${formatQuantity(product.min_stock)} ${product.unit}`
                                            : '—'}
                                    </span>
                                </DataItem>
                                <DataItem label="Unidad">
                                    {product.unit}
                                </DataItem>
                                <DataItem label="Afectación IGV">
                                    {IGV_LABELS[product.igv_affectation] ??
                                        product.igv_affectation}
                                </DataItem>
                                <DataItem label="Código SUNAT">
                                    <span className="tabular-nums">
                                        {product.sunat_product_code ?? '—'}
                                    </span>
                                </DataItem>
                                <DataItem label="Estado">
                                    <StatusBadge
                                        tone={
                                            product.is_active
                                                ? 'success'
                                                : 'neutral'
                                        }
                                    >
                                        {product.is_active
                                            ? 'Activo'
                                            : 'Inactivo'}
                                    </StatusBadge>
                                </DataItem>
                                <DataItem label="Registrado">
                                    {formatDateTime(product.created_at)}
                                </DataItem>
                                <DataItem
                                    label="Descripción"
                                    className="col-span-2"
                                >
                                    {product.description ? (
                                        <span className="whitespace-pre-line">
                                            {product.description}
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </DataItem>
                            </dl>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Movimientos de inventario"
                        description="Entradas, salidas y ajustes del stock."
                        flush
                    >
                        <div className="grid gap-4 p-4">
                            <ResponsiveDataTable
                                data={movements.data}
                                columns={columns}
                                getRowId={(row) => row.id}
                                caption="Movimientos de inventario"
                                emptyState={
                                    <EmptyState
                                        icon={History}
                                        title="Sin movimientos"
                                        description="Aquí aparecerán las entradas, salidas y ajustes de stock."
                                    />
                                }
                            />
                            <DataTablePagination paginator={movements} />
                        </div>
                    </SectionCard>
                </div>
            </PageContainer>

            {can.adjustStock && (
                <ProductStockDialog
                    open={stockOpen}
                    onOpenChange={setStockOpen}
                    product={product}
                />
            )}

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`¿Eliminar el producto ${product.name}?`}
                description="El producto dejará de estar disponible. Se conserva su historial de movimientos de inventario."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ProductShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Productos y repuestos', href: productsIndex() },
        { title: props.product.name, href: show(props.product.id) },
    ],
});
