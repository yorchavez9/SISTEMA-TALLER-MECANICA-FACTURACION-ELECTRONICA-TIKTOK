import { Head, Link, usePage } from '@inertiajs/react';
import { CircleAlert, Lock, Pencil, Phone, Printer } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EditHeaderDialog } from '@/components/work-orders/edit-header-dialog';
import { ItemsEditor } from '@/components/work-orders/items-editor';
import { StatusActions } from '@/components/work-orders/status-actions';
import { WorkOrderTimeline } from '@/components/work-orders/timeline';
import type {
    WorkOrderDetail,
    WorkOrderShowProps,
} from '@/components/work-orders/types';
import { formatDateTime, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { show as customerShow } from '@/routes/customers';
import { index as workOrdersIndex, print, show } from '@/routes/work-orders';

type Props = WorkOrderShowProps;

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });

/** Fecha "YYYY-MM-DD" sin desfase de zona horaria. */
const formatDate = (value: string | null): string => {
    if (!value) {
        return '—';
    }

    const [y, m, d] = value.split('-').map(Number);

    return dateFormat.format(new Date(y, m - 1, d));
};

/** Fecha de hoy en Lima como "YYYY-MM-DD". */
const todayInLima = (): string =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());

const LOCKED_MESSAGES: Record<string, string> = {
    finished: 'La orden está finalizada y ya no se puede modificar.',
    delivered: 'La orden fue entregada y ya no se puede modificar.',
    cancelled: 'La orden está cancelada y ya no se puede modificar.',
};

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

function TextBlock({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="min-w-0">
            <h3 className="text-sm text-muted-foreground">{label}</h3>
            {value ? (
                <p className="mt-1 text-[0.9375rem] break-words whitespace-pre-line">
                    {value}
                </p>
            ) : (
                <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                    Sin registrar
                </p>
            )}
        </div>
    );
}

const km = (value: number | null) =>
    value !== null ? `${formatQuantity(value)} km` : '—';

function isOverdue(order: WorkOrderDetail): boolean {
    if (!order.promised_at) {
        return false;
    }

    if (['finished', 'delivered', 'cancelled'].includes(order.status)) {
        return false;
    }

    return order.promised_at < todayInLima();
}

export default function WorkOrderShow({
    order,
    items,
    timeline,
    transitions,
    statuses,
    mechanics,
    can,
}: Props) {
    const { errors } = usePage().props as { errors: Record<string, string> };
    const [editOpen, setEditOpen] = useState(false);

    const canEdit = can.update && order.editable;
    const overdue = isOverdue(order);

    return (
        <>
            <Head title={`Orden ${order.code}`} />

            <PageContainer>
                <PageHeader
                    title={order.code}
                    description={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <StatusBadge tone={order.status_tone}>
                                {order.status_label}
                            </StatusBadge>
                            <span className="min-w-0 break-words">
                                <span className="font-medium text-foreground tabular-nums">
                                    {order.vehicle.plate}
                                </span>
                                {order.vehicle.description &&
                                    ` · ${order.vehicle.description}`}
                            </span>
                        </span>
                    }
                    actions={
                        <>
                            <Button variant="outline" className="h-10" asChild>
                                <a
                                    href={print.url(order.id)}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    <Printer />
                                    Imprimir
                                </a>
                            </Button>
                            {canEdit && (
                                <Button
                                    variant="outline"
                                    className="h-10"
                                    onClick={() => setEditOpen(true)}
                                >
                                    <Pencil />
                                    Editar datos
                                </Button>
                            )}
                            {can.update && (
                                <StatusActions
                                    order={order}
                                    transitions={transitions}
                                />
                            )}
                        </>
                    }
                />

                {errors.status && (
                    <Alert variant="destructive">
                        <CircleAlert />
                        <AlertTitle>No se pudo completar la acción</AlertTitle>
                        <AlertDescription className="text-[0.9375rem]">
                            {errors.status}
                        </AlertDescription>
                    </Alert>
                )}

                {!order.editable && (
                    <Alert>
                        <Lock />
                        <AlertTitle className="text-[0.9375rem]">
                            {LOCKED_MESSAGES[order.status] ??
                                'La orden ya no se puede modificar.'}
                        </AlertTitle>
                        <AlertDescription className="text-sm">
                            Los ítems, el diagnóstico y los datos de ingreso
                            quedan bloqueados.
                            {order.status === 'finished' &&
                                ' La venta y el comprobante se generan desde la orden finalizada en la siguiente fase.'}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
                    <div className="grid min-w-0 gap-6 lg:col-span-2">
                        <ItemsEditor
                            order={order}
                            items={items}
                            canEdit={canEdit}
                        />

                        <SectionCard
                            title="Problema y diagnóstico"
                            action={
                                canEdit ? (
                                    <Button
                                        variant="outline"
                                        className="h-10 w-full sm:w-auto"
                                        onClick={() => setEditOpen(true)}
                                    >
                                        <Pencil />
                                        Editar
                                    </Button>
                                ) : undefined
                            }
                        >
                            <div className="grid gap-5">
                                <TextBlock
                                    label="Problema reportado"
                                    value={order.reported_problem}
                                />
                                <TextBlock
                                    label="Diagnóstico"
                                    value={order.diagnosis}
                                />
                                <TextBlock
                                    label="Observaciones"
                                    value={order.observations}
                                />
                            </div>
                        </SectionCard>
                    </div>

                    <div className="grid min-w-0 gap-6">
                        <SectionCard title="Cliente y vehículo">
                            <div className="grid gap-5">
                                <div className="min-w-0 space-y-1">
                                    <Link
                                        href={customerShow(order.customer.id)}
                                        className="text-[0.9375rem] font-medium break-words text-link hover:underline"
                                    >
                                        {order.customer.name}
                                    </Link>
                                    <p className="text-sm text-muted-foreground tabular-nums">
                                        {order.customer.document}
                                    </p>
                                    {order.customer.phone && (
                                        <a
                                            href={`tel:${order.customer.phone.replace(/\s+/g, '')}`}
                                            className="inline-flex min-h-10 items-center gap-2 text-[0.9375rem] text-link tabular-nums hover:underline"
                                        >
                                            <Phone className="size-4" />
                                            {order.customer.phone}
                                        </a>
                                    )}
                                </div>

                                <div className="min-w-0 space-y-1 border-t pt-4">
                                    <p className="text-lg font-semibold tracking-wide tabular-nums">
                                        {order.vehicle.plate}
                                    </p>
                                    {order.vehicle.description && (
                                        <p className="text-[0.9375rem] break-words">
                                            {order.vehicle.description}
                                        </p>
                                    )}
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
                                        <DataItem label="Color">
                                            {order.vehicle.color ?? '—'}
                                        </DataItem>
                                        <DataItem label="Km actual">
                                            <span className="tabular-nums">
                                                {km(
                                                    order.vehicle
                                                        .current_mileage,
                                                )}
                                            </span>
                                        </DataItem>
                                    </dl>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Ingreso">
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                                <DataItem
                                    label="Recibido"
                                    className="col-span-2"
                                >
                                    {formatDateTime(order.received_at)}
                                </DataItem>
                                <DataItem label="Km de ingreso">
                                    <span className="tabular-nums">
                                        {km(order.mileage_in)}
                                    </span>
                                </DataItem>
                                <DataItem label="Fecha prometida">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={cn(
                                                overdue &&
                                                    'font-medium text-destructive-foreground',
                                            )}
                                        >
                                            {formatDate(order.promised_at)}
                                        </span>
                                        {overdue && (
                                            <StatusBadge tone="danger">
                                                Vencida
                                            </StatusBadge>
                                        )}
                                    </span>
                                </DataItem>
                                <DataItem label="Técnico asignado">
                                    {order.assigned_to ?? (
                                        <span className="text-muted-foreground">
                                            Sin asignar
                                        </span>
                                    )}
                                </DataItem>
                                <DataItem label="Registrado por">
                                    {order.created_by ?? '—'}
                                </DataItem>
                                {order.finished_at && (
                                    <DataItem
                                        label="Finalizada"
                                        className="col-span-2"
                                    >
                                        {formatDateTime(order.finished_at)}
                                    </DataItem>
                                )}
                                {order.delivered_at && (
                                    <DataItem
                                        label="Entregada"
                                        className="col-span-2"
                                    >
                                        {formatDateTime(order.delivered_at)}
                                    </DataItem>
                                )}
                                {order.cancelled_at && (
                                    <DataItem
                                        label="Cancelada"
                                        className="col-span-2"
                                    >
                                        {formatDateTime(order.cancelled_at)}
                                    </DataItem>
                                )}
                            </dl>
                        </SectionCard>

                        <SectionCard title="Historial">
                            <WorkOrderTimeline
                                entries={timeline}
                                statuses={statuses}
                            />
                        </SectionCard>
                    </div>
                </div>
            </PageContainer>

            {canEdit && (
                <EditHeaderDialog
                    order={order}
                    mechanics={mechanics}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}
        </>
    );
}

WorkOrderShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Órdenes de trabajo', href: workOrdersIndex() },
        { title: props.order.code, href: show(props.order.id) },
    ],
});
