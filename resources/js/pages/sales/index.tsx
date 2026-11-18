import { Head, Link, usePage } from '@inertiajs/react';
import { Eye, Plus, Receipt } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { create, index as salesIndex, show } from '@/routes/sales';
import { show as workOrderShow } from '@/routes/work-orders';
import type { Paginated } from '@/types';

export type SaleRow = {
    id: number;
    code: string;
    customer: { name: string; document: string } | null;
    work_order: { id: number; code: string } | null;
    issued_at: string;
    total: string;
    status: 'registered' | 'voided';
    payment_methods: string[];
};

type Filters = {
    search: string;
    status: '' | 'registered' | 'voided';
    from: string;
    to: string;
};

type Props = {
    sales: Paginated<SaleRow>;
    summary: { count: number; total: string };
    filters: Filters;
    can: { create: boolean };
};

/** Valor centinela del select para "Todas" (Radix no admite value=""). */
const ALL_STATUSES = 'all';

const STATUS_OPTIONS = [
    { value: ALL_STATUSES, label: 'Todas' },
    { value: 'registered', label: 'Registradas' },
    { value: 'voided', label: 'Anuladas' },
];

const columns: DataTableColumn<SaleRow>[] = [
    {
        id: 'code',
        header: 'Venta',
        priority: 'primary',
        cell: (row) => (
            <div className="flex min-w-0 flex-col items-start gap-1">
                <Link
                    href={show(row.id)}
                    className="font-semibold whitespace-nowrap tabular-nums underline-offset-4 hover:underline"
                >
                    {row.code}
                </Link>
                {row.status === 'voided' && (
                    <StatusBadge tone="danger">Anulada</StatusBadge>
                )}
            </div>
        ),
    },
    {
        id: 'total',
        header: 'Total',
        priority: 'primary',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span
                className={cn(
                    'whitespace-nowrap',
                    row.status === 'voided'
                        ? 'text-muted-foreground line-through'
                        : 'font-medium',
                )}
            >
                {formatMoney(row.total)}
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
                    <p className="break-words">{row.customer.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {row.customer.document}
                    </p>
                </div>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        id: 'issued_at',
        header: 'Fecha',
        priority: 'md',
        cell: (row) => (
            <span className="tabular-nums">
                {formatDateTime(row.issued_at)}
            </span>
        ),
    },
    {
        id: 'origin',
        header: 'Origen',
        priority: 'lg',
        cell: (row) =>
            row.work_order ? (
                <Link
                    href={workOrderShow(row.work_order.id)}
                    className="whitespace-nowrap text-link tabular-nums hover:underline"
                >
                    {row.work_order.code}
                </Link>
            ) : (
                <span className="text-muted-foreground">Venta directa</span>
            ),
    },
    {
        id: 'payment_methods',
        header: 'Pago',
        priority: 'lg',
        cell: (row) =>
            row.payment_methods.length > 0 ? (
                row.payment_methods.join(', ')
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
];

export default function SalesIndex({ sales, summary, filters, can }: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };

    const applyFilters = useTableFilters<{
        search: string;
        status: string;
        from: string;
        to: string;
    }>(salesIndex.url(), {
        search: filters.search,
        status: filters.status,
        from: filters.from,
        to: filters.to,
    });

    const hasFilters =
        filters.search !== '' ||
        filters.status !== '' ||
        filters.from !== '' ||
        filters.to !== '';
    const activeFilters =
        (filters.status !== '' ? 1 : 0) +
        (filters.from !== '' ? 1 : 0) +
        (filters.to !== '' ? 1 : 0);

    const newSaleButton = (
        <Button asChild>
            <Link href={create()}>
                <Plus />
                Nueva venta
            </Link>
        </Button>
    );

    return (
        <>
            <Head title="Ventas" />

            <PageContainer>
                <PageHeader
                    title="Ventas"
                    description="Ventas directas de mostrador y ventas de órdenes de trabajo. Las ventas de órdenes finalizadas se generan desde la propia orden."
                    actions={can.create && newSaleButton}
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="N.º de venta, cliente o documento"
                    activeFilters={activeFilters}
                    filters={
                        <>
                            <SelectInput
                                id="status-filter"
                                value={filters.status || ALL_STATUSES}
                                onChange={(status) =>
                                    applyFilters({
                                        status:
                                            status === ALL_STATUSES
                                                ? ''
                                                : status,
                                    })
                                }
                                options={STATUS_OPTIONS}
                                className="md:w-40"
                            />
                            <div className="flex min-w-0 items-center gap-2">
                                <Label
                                    htmlFor="from-filter"
                                    className="w-14 shrink-0 text-[0.9375rem] font-normal md:w-auto"
                                >
                                    Desde
                                </Label>
                                <Input
                                    id="from-filter"
                                    type="date"
                                    value={filters.from}
                                    max={filters.to || undefined}
                                    onChange={(e) =>
                                        applyFilters({ from: e.target.value })
                                    }
                                    className="h-10 min-w-0 flex-1 text-[0.9375rem] md:w-40 md:flex-none"
                                />
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                                <Label
                                    htmlFor="to-filter"
                                    className="w-14 shrink-0 text-[0.9375rem] font-normal md:w-auto"
                                >
                                    Hasta
                                </Label>
                                <Input
                                    id="to-filter"
                                    type="date"
                                    value={filters.to}
                                    min={filters.from || undefined}
                                    onChange={(e) =>
                                        applyFilters({ to: e.target.value })
                                    }
                                    className="h-10 min-w-0 flex-1 text-[0.9375rem] md:w-40 md:flex-none"
                                />
                            </div>
                        </>
                    }
                />

                <InputError message={pageErrors.to ?? pageErrors.from} />
                <InputError message={pageErrors.api} />

                <p className="-mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground tabular-nums">
                        {summary.count}{' '}
                        {summary.count === 1 ? 'venta' : 'ventas'}
                    </span>
                    {' · Total '}
                    <span className="font-medium text-foreground tabular-nums">
                        {formatMoney(summary.total)}
                    </span>
                    <span className="hidden sm:inline">
                        {' '}
                        (solo registradas)
                    </span>
                </p>

                <ResponsiveDataTable
                    data={sales.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Ventas"
                    actions={(row) => [
                        { label: 'Ver', icon: Eye, href: show(row.id) },
                    ]}
                    emptyState={
                        <EmptyState
                            icon={Receipt}
                            title={
                                hasFilters
                                    ? 'Sin resultados'
                                    : 'Aún no hay ventas'
                            }
                            description={
                                hasFilters
                                    ? 'Pruebe con otros términos de búsqueda o cambie los filtros.'
                                    : 'Registre una venta directa o genere la venta desde una orden de trabajo finalizada.'
                            }
                            action={!hasFilters && can.create && newSaleButton}
                        />
                    }
                />

                <DataTablePagination paginator={sales} />
            </PageContainer>
        </>
    );
}

SalesIndex.layout = {
    breadcrumbs: [{ title: 'Ventas', href: salesIndex() }],
};
