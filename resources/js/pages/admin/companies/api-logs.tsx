import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, FileSearch, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useBreakpoints } from '@/hooks/use-media-query';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatDateTime } from '@/lib/format';
import {
    apiLogs,
    index as companiesIndex,
    show,
} from '@/routes/admin/companies';
import type { Paginated } from '@/types';

type LogRow = {
    id: number;
    operation: string;
    http_method: string;
    endpoint: string;
    http_status: number | null;
    api_mensaje: string | null;
    error_type: string | null;
    duration_ms: number | null;
    request_summary: Record<string, unknown> | unknown[] | null;
    response_body: string | null;
    user: string | null;
    created_at: string;
};

type Filters = { search: string; result: '' | 'ok' | 'error' };

type Props = {
    company: { id: number; legal_name: string; ruc: string };
    logs: Paginated<LogRow>;
    filters: Filters;
};

const RESULT_OPTIONS = [
    { value: 'all', label: 'Todos los resultados' },
    { value: 'ok', label: 'Correctas' },
    { value: 'error', label: 'Con error' },
];

const durationFormat = new Intl.NumberFormat('es-PE');

function ResultBadge({ row }: { row: LogRow }) {
    return row.error_type === null ? (
        <StatusBadge tone="success">
            OK{row.http_status !== null ? ` ${row.http_status}` : ''}
        </StatusBadge>
    ) : (
        <StatusBadge tone="danger">
            {row.error_type}
            {row.http_status !== null ? ` · ${row.http_status}` : ''}
        </StatusBadge>
    );
}

function formatDuration(ms: number | null): string {
    return ms === null ? '—' : `${durationFormat.format(ms)} ms`;
}

/** Muestra el cuerpo de respuesta formateado si es JSON. */
function prettyBody(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

const columns: DataTableColumn<LogRow>[] = [
    {
        id: 'created_at',
        header: 'Fecha',
        priority: 'primary',
        className: 'w-[36%] md:w-44',
        cell: (row) => (
            <span className="text-sm tabular-nums md:whitespace-nowrap">
                {formatDateTime(row.created_at)}
            </span>
        ),
    },
    {
        id: 'operation',
        header: 'Operación',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-mono text-sm break-all">
                    <span className="font-semibold">{row.http_method}</span>{' '}
                    {row.endpoint}
                </p>
                <p className="text-sm break-words text-muted-foreground">
                    {row.operation}
                </p>
            </div>
        ),
    },
    {
        id: 'result',
        header: 'Resultado',
        priority: 'md',
        cell: (row) => <ResultBadge row={row} />,
    },
    {
        id: 'message',
        header: 'Mensaje',
        priority: 'lg',
        cell: (row) =>
            row.api_mensaje ? (
                <span className="line-clamp-2">{row.api_mensaje}</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        id: 'duration',
        header: 'Duración',
        priority: 'lg',
        className: 'tabular-nums md:whitespace-nowrap',
        cell: (row) => formatDuration(row.duration_ms),
    },
    {
        id: 'user',
        header: 'Usuario',
        priority: 'lg',
        cell: (row) =>
            row.user ?? <span className="text-muted-foreground">Sistema</span>,
    },
];

export default function CompanyApiLogs({ company, logs, filters }: Props) {
    const applyFilters = useTableFilters(apiLogs.url(company.id), filters);
    const { isMobile } = useBreakpoints();
    const [selected, setSelected] = useState<LogRow | null>(null);
    const filtered = filters.search !== '' || filters.result !== '';

    return (
        <>
            <Head title={`Registro de llamadas · ${company.legal_name}`} />

            <PageContainer>
                <PageHeader
                    title="Registro de llamadas a la API"
                    description={
                        <>
                            {company.legal_name} · RUC{' '}
                            <span className="tabular-nums">{company.ruc}</span>
                        </>
                    }
                    actions={
                        <Button asChild variant="outline">
                            <Link href={show(company.id)}>
                                <ArrowLeft />
                                Volver al taller
                            </Link>
                        </Button>
                    }
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Buscar por operación, endpoint o mensaje"
                    activeFilters={filters.result ? 1 : 0}
                    filters={
                        <SelectInput
                            id="result-filter"
                            value={filters.result || 'all'}
                            onChange={(value) =>
                                applyFilters({
                                    result:
                                        value === 'all'
                                            ? ''
                                            : (value as Filters['result']),
                                })
                            }
                            options={RESULT_OPTIONS}
                            className="md:w-52"
                        />
                    }
                />

                <ResponsiveDataTable
                    data={logs.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Registro de llamadas a la API"
                    actions={(row) => [
                        {
                            label: 'Ver detalle',
                            icon: FileSearch,
                            onClick: () => setSelected(row),
                        },
                    ]}
                    emptyState={
                        <EmptyState
                            icon={ScrollText}
                            title={
                                filtered
                                    ? 'Sin resultados'
                                    : 'Aún no hay llamadas registradas'
                            }
                            description={
                                filtered
                                    ? 'Pruebe con otros términos de búsqueda o filtros.'
                                    : 'Aquí aparecerán las llamadas que el sistema haga a la API de facturación para este taller.'
                            }
                        />
                    }
                />

                <DataTablePagination paginator={logs} />
            </PageContainer>

            <Sheet
                open={selected !== null}
                onOpenChange={(open) => !open && setSelected(null)}
            >
                <SheetContent
                    side={isMobile ? 'bottom' : 'right'}
                    className={
                        isMobile
                            ? 'max-h-[90svh] overflow-y-auto'
                            : 'w-full overflow-y-auto sm:max-w-xl'
                    }
                >
                    {selected && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="font-mono text-base break-all">
                                    {selected.http_method} {selected.endpoint}
                                </SheetTitle>
                                <SheetDescription className="text-[0.9375rem]">
                                    {selected.operation} ·{' '}
                                    {formatDateTime(selected.created_at)}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="grid gap-5 px-4 pb-6">
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                        <dt className="text-sm text-muted-foreground">
                                            Resultado
                                        </dt>
                                        <dd className="mt-0.5">
                                            <ResultBadge row={selected} />
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">
                                            Duración
                                        </dt>
                                        <dd className="text-[0.9375rem] tabular-nums">
                                            {formatDuration(
                                                selected.duration_ms,
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">
                                            Usuario
                                        </dt>
                                        <dd className="text-[0.9375rem]">
                                            {selected.user ?? 'Sistema'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm text-muted-foreground">
                                            Estado HTTP
                                        </dt>
                                        <dd className="text-[0.9375rem] tabular-nums">
                                            {selected.http_status ?? '—'}
                                        </dd>
                                    </div>
                                    {selected.api_mensaje && (
                                        <div className="col-span-2">
                                            <dt className="text-sm text-muted-foreground">
                                                Mensaje de la API
                                            </dt>
                                            <dd className="text-[0.9375rem] break-words">
                                                {selected.api_mensaje}
                                            </dd>
                                        </div>
                                    )}
                                </dl>

                                <div className="grid gap-2">
                                    <h3 className="font-medium">
                                        Solicitud (resumen)
                                    </h3>
                                    {selected.request_summary ? (
                                        <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-sm break-words whitespace-pre-wrap">
                                            {JSON.stringify(
                                                selected.request_summary,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    ) : (
                                        <p className="text-[0.9375rem] text-muted-foreground">
                                            Sin datos de la solicitud.
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <h3 className="font-medium">Respuesta</h3>
                                    {selected.response_body ? (
                                        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all whitespace-pre-wrap">
                                            {prettyBody(selected.response_body)}
                                        </pre>
                                    ) : (
                                        <p className="text-[0.9375rem] text-muted-foreground">
                                            Sin cuerpo de respuesta.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}

CompanyApiLogs.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Talleres', href: companiesIndex() },
        { title: props.company.legal_name, href: show(props.company.id) },
        { title: 'Registro de llamadas', href: apiLogs(props.company.id) },
    ],
});
