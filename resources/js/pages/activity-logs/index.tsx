import { Head } from '@inertiajs/react';
import { History } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatDateTime } from '@/lib/format';
import { index as activityLogsIndex } from '@/routes/activity-logs';
import type { Paginated } from '@/types';

type ActivityLogRow = {
    id: number;
    action: string;
    description: string;
    user: { name: string; email: string } | null;
    ip_address: string | null;
    created_at: string;
};

type Props = {
    logs: Paginated<ActivityLogRow>;
    filters: { search: string };
};

const columns: DataTableColumn<ActivityLogRow>[] = [
    {
        id: 'created_at',
        header: 'Fecha',
        priority: 'primary',
        className: 'w-[38%] md:w-44',
        cell: (row) => (
            <span className="text-sm whitespace-nowrap tabular-nums">
                {formatDateTime(row.created_at)}
            </span>
        ),
    },
    {
        id: 'description',
        header: 'Descripción',
        priority: 'primary',
        cell: (row) => (
            <span className="line-clamp-2 md:line-clamp-none">
                {row.description}
            </span>
        ),
    },
    {
        id: 'user',
        header: 'Usuario',
        priority: 'md',
        cell: (row) =>
            row.user ? (
                <div className="min-w-0">
                    <p className="truncate">{row.user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                        {row.user.email}
                    </p>
                </div>
            ) : (
                <span className="text-muted-foreground">Sistema</span>
            ),
    },
    {
        id: 'action',
        header: 'Acción',
        priority: 'lg',
        cell: (row) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm break-all">
                {row.action}
            </code>
        ),
    },
    {
        id: 'ip_address',
        header: 'IP',
        priority: 'lg',
        cell: (row) => (
            <span className="tabular-nums">{row.ip_address ?? '—'}</span>
        ),
    },
];

export default function ActivityLogsIndex({ logs, filters }: Props) {
    const applyFilters = useTableFilters(activityLogsIndex.url(), filters);

    return (
        <>
            <Head title="Registro de actividad" />

            <PageContainer>
                <PageHeader
                    title="Registro de actividad"
                    description="Operaciones importantes realizadas en el sistema."
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Buscar por descripción, acción o usuario"
                />

                <ResponsiveDataTable
                    data={logs.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Registro de actividad"
                    emptyState={
                        <EmptyState
                            icon={History}
                            title={
                                filters.search
                                    ? 'Sin resultados'
                                    : 'Aún no hay actividad'
                            }
                            description={
                                filters.search
                                    ? 'Pruebe con otros términos de búsqueda.'
                                    : 'Aquí aparecerán las operaciones importantes del sistema.'
                            }
                        />
                    }
                />

                <DataTablePagination paginator={logs} />
            </PageContainer>
        </>
    );
}

ActivityLogsIndex.layout = {
    breadcrumbs: [
        { title: 'Registro de actividad', href: activityLogsIndex() },
    ],
};
