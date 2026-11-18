import { Head, usePage } from '@inertiajs/react';
import {
    Eye,
    FileCode,
    FileText,
    FileArchive,
    ReceiptText,
} from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type {
    DataTableColumn,
    RowAction,
} from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { file, index as documentsIndex } from '@/routes/documents';
import { show as saleShow } from '@/routes/sales';
import type { Paginated } from '@/types';

export type DocumentType = '01' | '03' | '07' | '08';

export type DocumentStatus =
    | 'sending'
    | 'failed'
    | 'unknown'
    | 'pending'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'voided';

export type DocumentRow = {
    id: number;
    document_type: DocumentType;
    document_type_label: string;
    number: string;
    issue_date: string;
    customer_name: string;
    customer_document: string | null;
    total: string;
    status: DocumentStatus;
    status_label: string;
    status_tone: StatusTone;
    sunat_code: string | null;
    sunat_message: string | null;
    last_error: string | null;
    environment: 'beta' | 'production';
    sale_id: number | null;
    related_document_id: number | null;
    reason_description: string | null;
    detraction: { code: string; rate: string; amount: string } | null;
    has_api_id: boolean;
    accepted_at: string | null;
    last_checked_at: string | null;
};

type Filters = {
    search: string;
    type: string;
    status: string;
    from: string;
    to: string;
};

type Props = {
    documents: Paginated<DocumentRow>;
    filters: Filters;
    types: { value: string; label: string }[];
    statuses: { value: string; label: string; tone: StatusTone }[];
};

/** Valor centinela de los selects para "Todos" (Radix no admite value=""). */
const ALL = 'all';

/** "2026-11-18" → "18/11/2026", sin pasar por Date (evita desfase de zona horaria). */
function formatIssueDate(date: string): string {
    const [year, month, day] = date.slice(0, 10).split('-');

    return year && month && day ? `${day}/${month}/${year}` : date;
}

function openFile(row: DocumentRow, kind: 'pdf' | 'xml' | 'cdr'): void {
    const url = file.url(
        { document: row.id, kind },
        kind === 'pdf' ? { query: { format: 'a4' } } : undefined,
    );
    window.open(url, '_blank', 'noopener');
}

const columns: DataTableColumn<DocumentRow>[] = [
    {
        id: 'number',
        header: 'Comprobante',
        priority: 'primary',
        cell: (row) => (
            <div className="flex min-w-0 flex-col items-start">
                <span className="text-sm text-muted-foreground">
                    {row.document_type_label}
                </span>
                <span className="flex items-center gap-2">
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                        {row.number}
                    </span>
                    {row.environment === 'beta' && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Beta
                        </span>
                    )}
                </span>
            </div>
        ),
    },
    {
        id: 'status',
        header: 'Estado',
        priority: 'primary',
        cell: (row) => (
            <StatusBadge tone={row.status_tone}>{row.status_label}</StatusBadge>
        ),
    },
    {
        id: 'customer',
        header: 'Cliente',
        priority: 'md',
        cell: (row) => (
            <div className="min-w-0">
                <p className="break-words">{row.customer_name}</p>
                {row.customer_document && (
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {row.customer_document}
                    </p>
                )}
            </div>
        ),
    },
    {
        id: 'issue_date',
        header: 'Fecha',
        priority: 'md',
        cell: (row) => (
            <span className="whitespace-nowrap tabular-nums">
                {formatIssueDate(row.issue_date)}
            </span>
        ),
    },
    {
        id: 'total',
        header: 'Total',
        priority: 'lg',
        className: 'text-right tabular-nums',
        cell: (row) =>
            row.document_type === '07' ? (
                <span className="whitespace-nowrap text-muted-foreground">
                    −{formatMoney(row.total)}
                </span>
            ) : (
                <span className="font-medium whitespace-nowrap">
                    {formatMoney(row.total)}
                </span>
            ),
    },
    {
        id: 'sunat',
        header: 'SUNAT',
        priority: 'lg',
        cell: (row) => {
            if (row.last_error && row.status === 'failed') {
                return (
                    <p
                        className="line-clamp-2 max-w-xs text-sm text-destructive"
                        title={row.last_error}
                    >
                        {row.last_error}
                    </p>
                );
            }

            if (row.sunat_code || row.sunat_message) {
                return (
                    <p
                        className={cn(
                            'line-clamp-2 max-w-xs text-sm',
                            row.status === 'rejected'
                                ? 'text-destructive'
                                : 'text-muted-foreground',
                        )}
                        title={row.sunat_message ?? undefined}
                    >
                        {row.sunat_code && (
                            <span className="font-medium tabular-nums">
                                {row.sunat_code}
                            </span>
                        )}
                        {row.sunat_code && row.sunat_message && ' · '}
                        {row.sunat_message}
                    </p>
                );
            }

            if (row.last_error) {
                return (
                    <p
                        className="line-clamp-2 max-w-xs text-sm text-destructive"
                        title={row.last_error}
                    >
                        {row.last_error}
                    </p>
                );
            }

            return <span className="text-muted-foreground">—</span>;
        },
    },
];

function rowActions(row: DocumentRow): RowAction[] {
    return [
        {
            label: 'Ver venta',
            icon: Eye,
            href: row.sale_id !== null ? saleShow(row.sale_id) : undefined,
            hidden: row.sale_id === null,
        },
        {
            label: 'PDF',
            icon: FileText,
            onClick: () => openFile(row, 'pdf'),
            hidden: !row.has_api_id,
        },
        {
            label: 'XML',
            icon: FileCode,
            onClick: () => openFile(row, 'xml'),
            hidden: !row.has_api_id,
        },
        {
            label: 'CDR',
            icon: FileArchive,
            onClick: () => openFile(row, 'cdr'),
            hidden:
                !row.has_api_id ||
                (row.status !== 'accepted' && row.status !== 'rejected'),
        },
    ];
}

export default function DocumentsIndex({
    documents,
    filters,
    types,
    statuses,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };

    const applyFilters = useTableFilters<Filters>(documentsIndex.url(), {
        search: filters.search,
        type: filters.type,
        status: filters.status,
        from: filters.from,
        to: filters.to,
    });

    const typeOptions = [
        { value: ALL, label: 'Todos' },
        ...types.map(({ value, label }) => ({ value, label })),
    ];
    const statusOptions = [
        { value: ALL, label: 'Todos' },
        ...statuses.map(({ value, label }) => ({ value, label })),
    ];

    const hasFilters =
        filters.search !== '' ||
        filters.type !== '' ||
        filters.status !== '' ||
        filters.from !== '' ||
        filters.to !== '';
    const activeFilters =
        (filters.type !== '' ? 1 : 0) +
        (filters.status !== '' ? 1 : 0) +
        (filters.from !== '' ? 1 : 0) +
        (filters.to !== '' ? 1 : 0);

    return (
        <>
            <Head title="Comprobantes electrónicos" />

            <PageContainer>
                <PageHeader
                    title="Comprobantes electrónicos"
                    description="Facturas, boletas y notas emitidas a través de la API de facturación. Se emiten desde cada venta."
                />

                <DataTableToolbar
                    search={filters.search}
                    onSearch={(search) => applyFilters({ search })}
                    searchPlaceholder="Serie-número (F001-25), cliente o documento"
                    activeFilters={activeFilters}
                    filters={
                        <>
                            <SelectInput
                                id="type-filter"
                                value={filters.type || ALL}
                                onChange={(type) =>
                                    applyFilters({
                                        type: type === ALL ? '' : type,
                                    })
                                }
                                options={typeOptions}
                                className="md:w-44"
                            />
                            <SelectInput
                                id="status-filter"
                                value={filters.status || ALL}
                                onChange={(status) =>
                                    applyFilters({
                                        status: status === ALL ? '' : status,
                                    })
                                }
                                options={statusOptions}
                                className="md:w-44"
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

                <ResponsiveDataTable
                    data={documents.data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    caption="Comprobantes electrónicos"
                    actions={rowActions}
                    emptyState={
                        <EmptyState
                            icon={ReceiptText}
                            title={
                                hasFilters
                                    ? 'Sin resultados'
                                    : 'Aún no hay comprobantes'
                            }
                            description={
                                hasFilters
                                    ? 'Pruebe con otros términos de búsqueda o cambie los filtros.'
                                    : 'Emita una factura o boleta desde el detalle de una venta registrada.'
                            }
                        />
                    }
                />

                <DataTablePagination paginator={documents} />
            </PageContainer>
        </>
    );
}

DocumentsIndex.layout = {
    breadcrumbs: [
        { title: 'Comprobantes electrónicos', href: documentsIndex() },
    ],
};
