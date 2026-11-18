import { Link } from '@inertiajs/react';
import type { ColumnDef, ExpandedState } from '@tanstack/react-table';
import {
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Minus, MoreHorizontal, Plus } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useBreakpoints } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

/**
 * Prioridad de una columna:
 * - primary: siempre visible (también en móvil).
 * - md: visible desde tablet (≥ 768 px).
 * - lg: visible solo en escritorio (≥ 1024 px).
 * Las columnas ocultas se muestran en el panel que se despliega con "+".
 */
export type ColumnPriority = 'primary' | 'md' | 'lg';

export type DataTableColumn<T> = {
    id: string;
    header: string;
    cell: (row: T) => ReactNode;
    priority?: ColumnPriority;
    /** Etiqueta en el panel expandido (por defecto, el encabezado). */
    mobileLabel?: string;
    /** Clases para celda y encabezado, por ejemplo "text-right tabular-nums". */
    className?: string;
};

export type RowAction = {
    label: string;
    icon?: LucideIcon;
    href?: NonNullable<InertiaLinkProps['href']>;
    onClick?: () => void;
    variant?: 'default' | 'destructive';
    hidden?: boolean;
};

type Props<T> = {
    data: T[];
    columns: DataTableColumn<T>[];
    getRowId: (row: T) => string | number;
    /** Acciones por fila (ver, editar, eliminar...). */
    actions?: (row: T) => RowAction[];
    emptyState?: ReactNode;
    /** Texto para lectores de pantalla. */
    caption?: string;
};

const EXPAND_COLUMN_ID = '__expand';
const ACTIONS_COLUMN_ID = '__actions';

export function ResponsiveDataTable<T>({
    data,
    columns,
    getRowId,
    actions,
    emptyState,
    caption,
}: Props<T>) {
    const { isMobile, isDesktop } = useBreakpoints();
    const [expanded, setExpanded] = useState<ExpandedState>({});

    const isHidden = (column: DataTableColumn<T>): boolean => {
        const priority = column.priority ?? 'primary';

        return (
            (priority === 'md' && isMobile) || (priority === 'lg' && !isDesktop)
        );
    };

    const hiddenColumns = columns.filter(isHidden);
    // En móvil las acciones se muestran dentro del panel expandido.
    const actionsInPanel = isMobile && !!actions;
    const canExpand = hiddenColumns.length > 0 || actionsInPanel;

    const tableColumns = useMemo<ColumnDef<T>[]>(() => {
        const defs: ColumnDef<T>[] = columns.map((column) => ({
            id: column.id,
            header: column.header,
            cell: ({ row }) => column.cell(row.original),
            meta: { className: column.className },
        }));

        return [
            {
                id: EXPAND_COLUMN_ID,
                header: '',
                cell: () => null,
                meta: { className: 'w-12' },
            },
            ...defs,
            {
                id: ACTIONS_COLUMN_ID,
                header: 'Acciones',
                cell: () => null,
                meta: { className: 'w-16 text-right' },
            },
        ];
    }, [columns]);

    const columnVisibility = useMemo(() => {
        const visibility: Record<string, boolean> = {
            [EXPAND_COLUMN_ID]: canExpand,
            [ACTIONS_COLUMN_ID]: !!actions && !actionsInPanel,
        };

        columns.forEach((column) => {
            visibility[column.id] = !isHidden(column);
        });

        return visibility;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columns, isMobile, isDesktop, canExpand, actions, actionsInPanel]);

    const table = useReactTable({
        data,
        columns: tableColumns,
        state: { expanded, columnVisibility },
        onExpandedChange: setExpanded,
        getRowId: (row) => String(getRowId(row)),
        getRowCanExpand: () => canExpand,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    });

    const visibleColumnCount = table.getVisibleLeafColumns().length;

    return (
        <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-card">
            <Table className={cn(isMobile && 'table-fixed')}>
                {caption && <caption className="sr-only">{caption}</caption>}
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow
                            key={headerGroup.id}
                            className="bg-muted/50 hover:bg-muted/50"
                        >
                            {headerGroup.headers.map((header) => {
                                const meta = header.column.columnDef.meta as
                                    | { className?: string }
                                    | undefined;

                                return (
                                    <TableHead
                                        key={header.id}
                                        className={cn(
                                            'h-11 px-3 text-sm font-medium whitespace-normal text-muted-foreground',
                                            meta?.className,
                                        )}
                                    >
                                        {header.column.id ===
                                        EXPAND_COLUMN_ID ? (
                                            <span className="sr-only">
                                                Ver detalle
                                            </span>
                                        ) : header.column.id ===
                                          ACTIONS_COLUMN_ID ? (
                                            <span className="sr-only">
                                                Acciones
                                            </span>
                                        ) : (
                                            flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )
                                        )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={visibleColumnCount}>
                                {emptyState ?? (
                                    <p className="py-10 text-center text-muted-foreground">
                                        No hay registros para mostrar.
                                    </p>
                                )}
                            </TableCell>
                        </TableRow>
                    ) : (
                        table.getRowModel().rows.map((row) => {
                            const isExpanded = row.getIsExpanded();
                            const panelId = `row-detail-${row.id}`;
                            const rowActions = (
                                actions?.(row.original) ?? []
                            ).filter((action) => !action.hidden);

                            return (
                                <Fragment key={row.id}>
                                    <TableRow
                                        data-state={
                                            isExpanded ? 'selected' : undefined
                                        }
                                        className="hover:bg-muted/30 data-[state=selected]:bg-muted/40"
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            const meta = cell.column.columnDef
                                                .meta as
                                                | { className?: string }
                                                | undefined;

                                            if (
                                                cell.column.id ===
                                                EXPAND_COLUMN_ID
                                            ) {
                                                return (
                                                    <TableCell
                                                        key={cell.id}
                                                        className="w-12 px-2 py-2"
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="size-9"
                                                            aria-expanded={
                                                                isExpanded
                                                            }
                                                            aria-controls={
                                                                panelId
                                                            }
                                                            aria-label={
                                                                isExpanded
                                                                    ? 'Ocultar detalle'
                                                                    : 'Ver detalle'
                                                            }
                                                            onClick={() =>
                                                                row.toggleExpanded()
                                                            }
                                                        >
                                                            {isExpanded ? (
                                                                <Minus />
                                                            ) : (
                                                                <Plus />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                );
                                            }

                                            if (
                                                cell.column.id ===
                                                ACTIONS_COLUMN_ID
                                            ) {
                                                return (
                                                    <TableCell
                                                        key={cell.id}
                                                        className="w-16 px-3 py-2 text-right"
                                                    >
                                                        <RowActionsMenu
                                                            actions={rowActions}
                                                        />
                                                    </TableCell>
                                                );
                                            }

                                            return (
                                                <TableCell
                                                    key={cell.id}
                                                    className={cn(
                                                        'px-3 py-3 align-middle text-[0.9375rem] break-words whitespace-normal',
                                                        meta?.className,
                                                    )}
                                                >
                                                    {flexRender(
                                                        cell.column.columnDef
                                                            .cell,
                                                        cell.getContext(),
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>

                                    {isExpanded && canExpand && (
                                        <TableRow
                                            id={panelId}
                                            className="bg-muted/20 hover:bg-muted/20"
                                        >
                                            <TableCell
                                                colSpan={visibleColumnCount}
                                                className="px-4 py-4 whitespace-normal"
                                            >
                                                {hiddenColumns.length > 0 && (
                                                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                                                        {hiddenColumns.map(
                                                            (column) => (
                                                                <div
                                                                    key={
                                                                        column.id
                                                                    }
                                                                    className="min-w-0"
                                                                >
                                                                    <dt className="text-sm text-muted-foreground">
                                                                        {column.mobileLabel ??
                                                                            column.header}
                                                                    </dt>
                                                                    <dd className="text-[0.9375rem] break-words">
                                                                        {column.cell(
                                                                            row.original,
                                                                        )}
                                                                    </dd>
                                                                </div>
                                                            ),
                                                        )}
                                                    </dl>
                                                )}

                                                {actionsInPanel &&
                                                    rowActions.length > 0 && (
                                                        <div
                                                            className={cn(
                                                                'flex flex-col gap-2',
                                                                hiddenColumns.length >
                                                                    0 && 'mt-4',
                                                            )}
                                                        >
                                                            {rowActions.map(
                                                                (action) => (
                                                                    <RowActionButton
                                                                        key={
                                                                            action.label
                                                                        }
                                                                        action={
                                                                            action
                                                                        }
                                                                    />
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function RowActionsMenu({ actions }: { actions: RowAction[] }) {
    if (actions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label="Acciones"
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                {actions.map((action) => {
                    const Icon = action.icon;
                    const content = (
                        <>
                            {Icon && <Icon className="size-4" />}
                            {action.label}
                        </>
                    );

                    return action.href ? (
                        <DropdownMenuItem
                            key={action.label}
                            asChild
                            className="text-[0.9375rem]"
                        >
                            <Link href={action.href}>{content}</Link>
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            key={action.label}
                            variant={
                                action.variant === 'destructive'
                                    ? 'destructive'
                                    : 'default'
                            }
                            className="text-[0.9375rem]"
                            onSelect={() => action.onClick?.()}
                        >
                            {content}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function RowActionButton({ action }: { action: RowAction }) {
    const Icon = action.icon;
    const variant =
        action.variant === 'destructive' ? 'destructive' : 'outline';
    const className = 'h-11 w-full justify-center text-[0.9375rem]';

    if (action.href) {
        return (
            <Button asChild variant={variant} className={className}>
                <Link href={action.href}>
                    {Icon && <Icon />}
                    {action.label}
                </Link>
            </Button>
        );
    }

    return (
        <Button
            type="button"
            variant={variant}
            className={className}
            onClick={action.onClick}
        >
            {Icon && <Icon />}
            {action.label}
        </Button>
    );
}
