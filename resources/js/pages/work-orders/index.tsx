import { Head, Link, usePage } from '@inertiajs/react';
import { ClipboardList, Eye, Plus } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatDateTime, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { create, index as workOrdersIndex, show } from '@/routes/work-orders';
import type { Paginated } from '@/types';

export type WorkOrderRow = {
    id: number;
    code: string;
    status: string;
    status_label: string;
    status_tone: StatusTone;
    customer: string | null;
    vehicle: string | null;
    assigned_to: string | null;
    received_at: string;
    promised_at: string | null;
    total: string;
};

type StatusOption = { value: string; label: string; tone: StatusTone };

type Filters = { search: string; status: string; mine: boolean };

type Props = {
    orders: Paginated<WorkOrderRow>;
    filters: Filters;
    statuses: StatusOption[];
    can: { create: boolean };
};

/** Filtros rápidos sobre el listado (además del select de estado). */
const QUICK_STATUSES = [
    'open',
    'pending',
    'diagnosing',
    'in_progress',
    'finished',
] as const;

const promisedFormat = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeZone: 'America/Lima',
});

/** Fecha (AAAA-MM-DD) en hora de Lima, para comparar días completos. */
const limaDay = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(date);

/** La fecha de entrega ya pasó y la OT sigue sin terminar. */
function isOverdue(row: WorkOrderRow): boolean {
    if (
        !row.promised_at ||
        ['finished', 'delivered', 'cancelled'].includes(row.status)
    ) {
        return false;
    }

    return limaDay(new Date(row.promised_at)) < limaDay(new Date());
}

const columns: DataTableColumn<WorkOrderRow>[] = [
    {
        id: 'code',
        header: 'OT',
        priority: 'primary',
        cell: (row) => (
            <Link
                href={show(row.id)}
                className="font-semibold whitespace-nowrap tabular-nums underline-offset-4 hover:underline"
            >
                {row.code}
            </Link>
        ),
    },
    {
        id: 'vehicle',
        header: 'Vehículo',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium break-words">{row.vehicle ?? '—'}</p>
                {row.customer && (
                    <p className="text-sm break-words text-muted-foreground">
                        {row.customer}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'status',
        header: 'Estado',
        priority: 'md',
        cell: (row) => (
            <StatusBadge tone={row.status_tone}>{row.status_label}</StatusBadge>
        ),
    },
    {
        id: 'received_at',
        header: 'Ingreso',
        priority: 'lg',
        cell: (row) => {
            const overdue = isOverdue(row);

            return (
                <div className="min-w-0">
                    <p className="whitespace-nowrap tabular-nums">
                        {formatDateTime(row.received_at)}
                    </p>
                    {row.promised_at && (
                        <p
                            className={cn(
                                'text-sm whitespace-nowrap tabular-nums',
                                overdue
                                    ? 'font-medium text-warning-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            Entrega:{' '}
                            {promisedFormat.format(new Date(row.promised_at))}
                            {overdue && ' (vencida)'}
                        </p>
                    )}
                </div>
            );
        },
    },
    {
        id: 'assigned_to',
        header: 'Técnico',
        priority: 'lg',
        cell: (row) =>
            row.assigned_to ?? (
                <span className="text-muted-foreground">Sin asignar</span>
            ),
    },
    {
        id: 'total',
        header: 'Total',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">{formatMoney(row.total)}</span>
        ),
    },
];

export default function WorkOrdersIndex({
    orders,
    filters,
    statuses,
    can,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };

    // "mine" viaja como '1' (la validación `boolean` de Laravel no acepta "true").
    const applyFilters = useTableFilters<{
        search: string;
        status: string;
        mine: string;
    }>(workOrdersIndex.url(), {
        search: filters.search,
        status: filters.status,
        mine: filters.mine ? '1' : '',
    });

    const statusOptions = [
        { value: 'open', label: 'Abiertas' },
        ...statuses.map(({ value, label }) => ({ value, label })),
    ];
    const quickFilters = QUICK_STATUSES.map(
        (value) =>
            statusOptions.find((option) => option.value === value) ?? {
                value,
                label: value,
            },
    );

    const hasFilters =
        filters.search !== '' || filters.status !== 'open' || filters.mine;
    const activeFilters =
        (filters.status !== 'open' ? 1 : 0) + (filters.mine ? 1 : 0);

    const newOrderButton = (
        <Button asChild>
            <Link href={create()}>
                <Plus />
                Nueva orden
            </Link>
        </Button>
    );

    return (
        <>
            <Head title="Órdenes de trabajo" />

            <PageContainer>
                <PageHeader
                    title="Órdenes de trabajo"
                    description="Ingreso, seguimiento y entrega de los vehículos en el taller."
                    actions={can.create && newOrderButton}
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="N.º de OT, placa o cliente"
                    activeFilters={activeFilters}
                    filters={
                        <>
                            <SelectInput
                                id="status-filter"
                                value={filters.status}
                                onChange={(status) => applyFilters({ status })}
                                options={statusOptions}
                                className="md:w-48"
                            />
                            <div className="flex h-10 items-center gap-2 px-1">
                                <Checkbox
                                    id="mine-filter"
                                    checked={filters.mine}
                                    onCheckedChange={(checked) =>
                                        applyFilters({
                                            mine: checked === true ? '1' : '',
                                        })
                                    }
                                />
                                <Label
                                    htmlFor="mine-filter"
                                    className="text-[0.9375rem] font-normal whitespace-nowrap"
                                >
                                    Solo asignadas a mí
                                </Label>
                            </div>
                        </>
                    }
                />

                <div
                    className="-mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Filtros rápidos por estado"
                >
                    {quickFilters.map((option) => {
                        const active = filters.status === option.value;

                        return (
                            <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={active ? 'secondary' : 'ghost'}
                                aria-pressed={active}
                                onClick={() =>
                                    applyFilters({ status: option.value })
                                }
                                className={cn(
                                    'rounded-full border text-sm',
                                    active
                                        ? 'border-primary/30 font-semibold'
                                        : 'border-border font-normal text-muted-foreground',
                                )}
                            >
                                {option.label}
                            </Button>
                        );
                    })}
                </div>

                <InputError message={pageErrors.api} />

                <ResponsiveDataTable
                    data={orders.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Órdenes de trabajo"
                    actions={(row) => [
                        { label: 'Ver', icon: Eye, href: show(row.id) },
                    ]}
                    emptyState={
                        <EmptyState
                            icon={ClipboardList}
                            title={
                                hasFilters
                                    ? 'Sin resultados'
                                    : 'No hay órdenes abiertas'
                            }
                            description={
                                hasFilters
                                    ? 'Pruebe con otros términos de búsqueda o cambie los filtros.'
                                    : 'Registre una orden de trabajo cuando ingrese un vehículo al taller.'
                            }
                            action={can.create && newOrderButton}
                        />
                    }
                />

                <DataTablePagination paginator={orders} />
            </PageContainer>
        </>
    );
}

WorkOrdersIndex.layout = {
    breadcrumbs: [{ title: 'Órdenes de trabajo', href: workOrdersIndex() }],
};
