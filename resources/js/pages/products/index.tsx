import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Eye,
    PackageOpen,
    Pencil,
    Plus,
    Trash2,
    Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { ProductStockDialog } from '@/components/catalog/product-stock-dialog';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { ProductThumbnail } from '@/components/media/product-thumbnail';
import { Button } from '@/components/ui/button';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatMoney, formatQuantity } from '@/lib/format';
import {
    create,
    destroy,
    edit,
    index as productsIndex,
    show,
} from '@/routes/products';
import type { Option, Paginated } from '@/types';

export type ProductRow = {
    id: number;
    code: string;
    name: string;
    cost: string;
    sale_price: string;
    stock: string;
    min_stock: string | null;
    unit: string;
    igv_affectation: string;
    sunat_product_code: string | null;
    is_active: boolean;
    is_low_stock: boolean;
    thumb_url: string | null;
};

type Filters = {
    search: string;
    status: '' | 'active' | 'inactive' | 'low_stock';
};

type Props = {
    products: Paginated<ProductRow>;
    filters: Filters;
    can: { manage: boolean; adjustStock: boolean };
};

const STATUS_OPTIONS: Option[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
    { value: 'low_stock', label: 'Stock bajo' },
];

const columns: DataTableColumn<ProductRow>[] = [
    {
        id: 'product',
        header: 'Producto',
        priority: 'primary',
        cell: (row) => (
            <div className="flex min-w-0 items-center gap-3">
                <ProductThumbnail
                    src={row.thumb_url}
                    alt={row.name}
                    className="size-10 shrink-0"
                />
                <div className="min-w-0">
                    <Link
                        href={show(row.id)}
                        className="font-medium break-words hover:underline"
                    >
                        {row.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                        {row.code}
                    </p>
                </div>
            </div>
        ),
    },
    {
        id: 'stock',
        header: 'Stock',
        priority: 'primary',
        className: 'w-[34%] md:w-40',
        cell: (row) => (
            <div className="flex flex-col items-start gap-1">
                <span className="whitespace-nowrap tabular-nums">
                    {formatQuantity(row.stock)}{' '}
                    <span className="text-sm text-muted-foreground">
                        {row.unit}
                    </span>
                </span>
                {row.is_low_stock && (
                    <StatusBadge tone="warning">Stock bajo</StatusBadge>
                )}
            </div>
        ),
    },
    {
        id: 'sale_price',
        header: 'Precio',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatMoney(row.sale_price)}
            </span>
        ),
    },
    {
        id: 'cost',
        header: 'Costo',
        priority: 'lg',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">{formatMoney(row.cost)}</span>
        ),
    },
    {
        id: 'status',
        header: 'Estado',
        priority: 'lg',
        cell: (row) => (
            <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
                {row.is_active ? 'Activo' : 'Inactivo'}
            </StatusBadge>
        ),
    },
];

export default function ProductsIndex({ products, filters, can }: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const applyFilters = useTableFilters(productsIndex.url(), filters);

    const [stockProduct, setStockProduct] = useState<ProductRow | null>(null);
    const [stockOpen, setStockOpen] = useState(false);
    const [toDelete, setToDelete] = useState<ProductRow | null>(null);
    const [deleting, setDeleting] = useState(false);

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
            <Head title="Productos y repuestos" />

            <PageContainer>
                <PageHeader
                    title="Productos y repuestos"
                    description="Inventario de repuestos, lubricantes y otros productos. Los precios incluyen IGV."
                    actions={
                        can.manage && (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Nuevo producto
                                </Link>
                            </Button>
                        )
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Nombre o código"
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
                    data={products.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Productos y repuestos"
                    actions={(row) => [
                        { label: 'Ver', icon: Eye, href: show(row.id) },
                        {
                            label: 'Editar',
                            icon: Pencil,
                            href: edit(row.id),
                            hidden: !can.manage,
                        },
                        {
                            label: 'Ajustar stock',
                            icon: Warehouse,
                            onClick: () => {
                                setStockProduct(row);
                                setStockOpen(true);
                            },
                            hidden: !can.adjustStock,
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
                            icon={PackageOpen}
                            title={
                                hasFilters
                                    ? 'Sin resultados'
                                    : 'Aún no hay productos'
                            }
                            description={
                                hasFilters
                                    ? 'Pruebe con otros términos de búsqueda o filtros.'
                                    : 'Registre los repuestos y productos que vende el taller.'
                            }
                            action={
                                !hasFilters &&
                                can.manage && (
                                    <Button asChild>
                                        <Link href={create()}>
                                            <Plus />
                                            Nuevo producto
                                        </Link>
                                    </Button>
                                )
                            }
                        />
                    }
                />

                <DataTablePagination paginator={products} />
            </PageContainer>

            {can.adjustStock && (
                <ProductStockDialog
                    open={stockOpen}
                    onOpenChange={setStockOpen}
                    product={stockProduct}
                />
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => !open && setToDelete(null)}
                title={`¿Eliminar el producto ${toDelete?.name ?? ''}?`}
                description="El producto dejará de estar disponible. Se conserva su historial de movimientos de inventario."
                confirmLabel="Eliminar"
                variant="destructive"
                processing={deleting}
                onConfirm={confirmDelete}
            />
        </>
    );
}

ProductsIndex.layout = {
    breadcrumbs: [{ title: 'Productos y repuestos', href: productsIndex() }],
};
