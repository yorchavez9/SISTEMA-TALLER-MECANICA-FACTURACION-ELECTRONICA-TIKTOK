import { Head, Link, router } from '@inertiajs/react';
import { Building2, Eye, LogIn, Plus } from 'lucide-react';
import {
    BillingStatusBadge,
    EnvironmentBadge,
} from '@/components/admin/company-shared';
import type { Environment } from '@/components/admin/company-shared';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import { Button } from '@/components/ui/button';
import { useTableFilters } from '@/hooks/use-table-filters';
import {
    create,
    enter,
    index as companiesIndex,
    show,
} from '@/routes/admin/companies';
import type { BillingStatus, Paginated } from '@/types';

type CompanyRow = {
    id: number;
    ruc: string;
    legal_name: string;
    trade_name: string | null;
    status: 'active' | 'suspended';
    api_plan: string | null;
    users_count: number;
    billing_status: BillingStatus | null;
    billing_status_label: string | null;
    environment: Environment | null;
    created_at: string | null;
};

type Filters = { search: string; status: '' | 'active' | 'suspended' };

type Props = {
    companies: Paginated<CompanyRow>;
    filters: Filters;
};

const STATUS_OPTIONS = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'suspended', label: 'Suspendidos' },
];

const columns: DataTableColumn<CompanyRow>[] = [
    {
        id: 'legal_name',
        header: 'Taller',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium break-words">{row.legal_name}</p>
                {row.trade_name && (
                    <p className="truncate text-sm text-muted-foreground">
                        {row.trade_name}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'ruc',
        header: 'RUC',
        priority: 'primary',
        className: 'w-[34%] md:w-36',
        cell: (row) => <span className="tabular-nums">{row.ruc}</span>,
    },
    {
        id: 'billing',
        header: 'Facturación',
        priority: 'md',
        cell: (row) => (
            <BillingStatusBadge
                status={row.billing_status}
                label={row.billing_status_label}
            />
        ),
    },
    {
        id: 'environment',
        header: 'Entorno',
        priority: 'lg',
        cell: (row) => <EnvironmentBadge environment={row.environment} />,
    },
    {
        id: 'plan',
        header: 'Plan',
        priority: 'lg',
        cell: (row) =>
            row.api_plan ?? <span className="text-muted-foreground">—</span>,
    },
    {
        id: 'users',
        header: 'Usuarios',
        priority: 'lg',
        className: 'tabular-nums',
        cell: (row) => row.users_count,
    },
    {
        id: 'status',
        header: 'Estado',
        priority: 'md',
        cell: (row) =>
            row.status === 'active' ? (
                <StatusBadge tone="success">Activo</StatusBadge>
            ) : (
                <StatusBadge tone="danger">Suspendido</StatusBadge>
            ),
    },
];

export default function CompaniesIndex({ companies, filters }: Props) {
    const applyFilters = useTableFilters(companiesIndex.url(), filters);
    const filtered = filters.search !== '' || filters.status !== '';

    return (
        <>
            <Head title="Talleres" />

            <PageContainer>
                <PageHeader
                    title="Talleres"
                    description="Empresas registradas en el sistema y su conexión con la API de facturación."
                    actions={
                        <Button asChild>
                            <Link href={create()}>
                                <Plus />
                                Nuevo taller
                            </Link>
                        </Button>
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Buscar por RUC, razón social o nombre comercial"
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

                <ResponsiveDataTable
                    data={companies.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Talleres"
                    actions={(row) => [
                        { label: 'Ver', icon: Eye, href: show(row.id) },
                        {
                            label: 'Entrar al taller',
                            icon: LogIn,
                            onClick: () => router.post(enter.url(row.id)),
                        },
                    ]}
                    emptyState={
                        <EmptyState
                            icon={Building2}
                            title={
                                filtered
                                    ? 'Sin resultados'
                                    : 'Aún no hay talleres'
                            }
                            description={
                                filtered
                                    ? 'Pruebe con otros términos de búsqueda o filtros.'
                                    : 'Registre el primer taller para empezar a emitir comprobantes.'
                            }
                            action={
                                !filtered && (
                                    <Button asChild>
                                        <Link href={create()}>
                                            <Plus />
                                            Nuevo taller
                                        </Link>
                                    </Button>
                                )
                            }
                        />
                    }
                />

                <DataTablePagination paginator={companies} />
            </PageContainer>
        </>
    );
}

CompaniesIndex.layout = {
    breadcrumbs: [{ title: 'Talleres', href: companiesIndex() }],
};
