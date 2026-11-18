import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Ban, CircleAlert, FileText, ListX } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { show as customerShow } from '@/routes/customers';
import { index as salesIndex, show, voidMethod } from '@/routes/sales';
import { show as workOrderShow } from '@/routes/work-orders';

type SaleDetail = {
    id: number;
    code: string;
    status: 'registered' | 'voided';
    issued_at: string;
    currency: string;
    subtotal: string;
    igv: string;
    total: string;
    notes: string | null;
    created_by: string | null;
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    customer: {
        id: number;
        name: string;
        document: string;
        document_type: string;
        address: string | null;
    };
    work_order: { id: number; code: string; vehicle: string | null } | null;
};

type SaleItemRow = {
    id: number;
    type: 'service' | 'product' | 'labor';
    code: string | null;
    description: string;
    unit: string;
    quantity: string;
    unit_price: string;
    subtotal: string;
    igv: string;
    total: string;
    subject_to_detraction: boolean;
};

type PaymentRow = {
    id: number;
    method: string;
    method_label: string;
    amount: string;
    reference: string | null;
    paid_at: string;
};

type Props = {
    sale: SaleDetail;
    items: SaleItemRow[];
    payments: PaymentRow[];
    can: { void: boolean };
};

const MIN_REASON_LENGTH = 5;

const itemColumns: DataTableColumn<SaleItemRow>[] = [
    {
        id: 'description',
        header: 'Descripción',
        priority: 'primary',
        cell: (row) => (
            <div className="min-w-0">
                <p className="font-medium break-words">{row.description}</p>
                {(row.code || row.subject_to_detraction) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {row.code && (
                            <span className="text-sm text-muted-foreground tabular-nums">
                                {row.code}
                            </span>
                        )}
                        {row.subject_to_detraction && (
                            <StatusBadge tone="warning">Detracción</StatusBadge>
                        )}
                    </div>
                )}
            </div>
        ),
    },
    {
        id: 'quantity',
        header: 'Cant.',
        mobileLabel: 'Cantidad',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatQuantity(row.quantity)}{' '}
                <span className="text-sm text-muted-foreground">
                    {row.unit}
                </span>
            </span>
        ),
    },
    {
        id: 'unit_price',
        header: 'P. unit.',
        mobileLabel: 'Precio unitario',
        priority: 'md',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">
                {formatMoney(row.unit_price)}
            </span>
        ),
    },
    {
        id: 'igv',
        header: 'IGV',
        priority: 'lg',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="whitespace-nowrap">{formatMoney(row.igv)}</span>
        ),
    },
    {
        id: 'total',
        header: 'Importe',
        priority: 'primary',
        className: 'text-right tabular-nums',
        cell: (row) => (
            <span className="font-medium whitespace-nowrap">
                {formatMoney(row.total)}
            </span>
        ),
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

function TotalRow({
    label,
    value,
    strong,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-4',
                strong
                    ? 'border-t pt-2 text-base font-semibold'
                    : 'text-[0.9375rem]',
            )}
        >
            <dt className={cn(!strong && 'text-muted-foreground')}>{label}</dt>
            <dd className="tabular-nums">{formatMoney(value)}</dd>
        </div>
    );
}

function VoidSaleDialog({
    sale,
    open,
    onOpenChange,
}: {
    sale: SaleDetail;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({ reason: '' });
    const errors = form.errors as Record<string, string>;
    const tooShort = form.data.reason.trim().length < MIN_REASON_LENGTH;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (tooShort) {
            form.setError(
                'reason',
                `El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres.`,
            );

            return;
        }

        form.post(voidMethod.url(sale.id), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (form.processing) {
                    return;
                }

                if (!next) {
                    form.reset();
                    form.clearErrors();
                }

                onOpenChange(next);
            }}
        >
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>Anular la venta {sale.code}</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Se devolverá al inventario el stock de los
                            repuestos. Si la venta ya tiene comprobante
                            electrónico, deberá anularse con nota de crédito.
                        </DialogDescription>
                    </DialogHeader>

                    <FormField
                        label="Motivo de la anulación"
                        htmlFor="void_reason"
                        error={errors.reason}
                        hint={`Mínimo ${MIN_REASON_LENGTH} caracteres.`}
                        required
                    >
                        <Textarea
                            id="void_reason"
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                            rows={3}
                            maxLength={255}
                            placeholder="Ej. Error en el registro de la venta"
                            aria-invalid={!!errors.reason || undefined}
                            className="text-[0.9375rem]"
                            autoFocus
                        />
                    </FormField>

                    <InputError message={errors.void} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={form.processing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={form.processing || tooShort}
                        >
                            {form.processing && <Spinner />}
                            Anular venta
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function SaleShow({ sale, items, payments, can }: Props) {
    const { errors } = usePage().props as { errors: Record<string, string> };
    const [voidOpen, setVoidOpen] = useState(false);

    const voided = sale.status === 'voided';
    const totalPaid = payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
    );

    return (
        <>
            <Head title={`Venta ${sale.code}`} />

            <PageContainer>
                <PageHeader
                    title={sale.code}
                    description={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <StatusBadge tone={voided ? 'danger' : 'success'}>
                                {voided ? 'Anulada' : 'Registrada'}
                            </StatusBadge>
                            <span className="min-w-0 break-words">
                                {sale.customer.name} ·{' '}
                                <span className="tabular-nums">
                                    {formatDateTime(sale.issued_at)}
                                </span>
                            </span>
                        </span>
                    }
                    actions={
                        can.void && (
                            <Button
                                variant="outline"
                                className="h-10 text-destructive-foreground"
                                onClick={() => setVoidOpen(true)}
                            >
                                <Ban />
                                Anular venta
                            </Button>
                        )
                    }
                />

                {(errors.void || (errors.reason && !voidOpen)) && (
                    <Alert variant="destructive">
                        <CircleAlert />
                        <AlertTitle>No se pudo anular la venta</AlertTitle>
                        <AlertDescription className="text-[0.9375rem]">
                            {errors.void ?? errors.reason}
                        </AlertDescription>
                    </Alert>
                )}

                {voided && (
                    <Alert variant="destructive">
                        <Ban />
                        <AlertTitle className="text-[0.9375rem]">
                            Venta anulada
                        </AlertTitle>
                        <AlertDescription className="text-sm">
                            <p>
                                {formatDateTime(sale.voided_at)}
                                {sale.voided_by && ` · por ${sale.voided_by}`}
                            </p>
                            {sale.void_reason && (
                                <p className="break-words">
                                    Motivo: {sale.void_reason}
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
                    <div className="grid min-w-0 gap-6 lg:col-span-2">
                        <SectionCard title="Detalle" flush>
                            <div className="grid gap-4 p-4">
                                <ResponsiveDataTable
                                    data={items}
                                    columns={itemColumns}
                                    getRowId={(row) => row.id}
                                    caption="Detalle de la venta"
                                    emptyState={
                                        <EmptyState
                                            icon={ListX}
                                            title="Sin ítems"
                                            description="Esta venta no tiene ítems registrados."
                                        />
                                    }
                                />

                                <dl
                                    className={cn(
                                        'ml-auto grid w-full gap-2 sm:max-w-xs',
                                        voided && 'text-muted-foreground',
                                    )}
                                >
                                    <TotalRow
                                        label="Op. gravada"
                                        value={sale.subtotal}
                                    />
                                    <TotalRow label="IGV" value={sale.igv} />
                                    <TotalRow
                                        label="Total"
                                        value={sale.total}
                                        strong
                                    />
                                </dl>
                            </div>
                        </SectionCard>

                        {sale.notes && (
                            <SectionCard title="Notas">
                                <p className="text-[0.9375rem] break-words whitespace-pre-line">
                                    {sale.notes}
                                </p>
                            </SectionCard>
                        )}
                    </div>

                    <div className="grid min-w-0 gap-6">
                        <SectionCard title="Cliente">
                            <div className="min-w-0 space-y-1">
                                <Link
                                    href={customerShow(sale.customer.id)}
                                    className="text-[0.9375rem] font-medium break-words text-link hover:underline"
                                >
                                    {sale.customer.name}
                                </Link>
                                <p className="text-sm text-muted-foreground tabular-nums">
                                    {sale.customer.document}
                                </p>
                                {sale.customer.address && (
                                    <p className="text-sm break-words text-muted-foreground">
                                        {sale.customer.address}
                                    </p>
                                )}
                            </div>
                        </SectionCard>

                        <SectionCard title="Origen">
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                                <DataItem label="Tipo" className="col-span-2">
                                    {sale.work_order ? (
                                        <span className="flex flex-wrap items-center gap-x-2">
                                            Orden de trabajo
                                            <Link
                                                href={workOrderShow(
                                                    sale.work_order.id,
                                                )}
                                                className="font-medium text-link tabular-nums hover:underline"
                                            >
                                                {sale.work_order.code}
                                            </Link>
                                        </span>
                                    ) : (
                                        'Venta directa'
                                    )}
                                </DataItem>
                                {sale.work_order && (
                                    <DataItem label="Vehículo">
                                        <span className="font-medium tabular-nums">
                                            {sale.work_order.vehicle ?? '—'}
                                        </span>
                                    </DataItem>
                                )}
                                <DataItem label="Registrado por">
                                    {sale.created_by ?? '—'}
                                </DataItem>
                            </dl>
                        </SectionCard>

                        <SectionCard title="Pagos">
                            {payments.length === 0 ? (
                                <p className="text-[0.9375rem] text-muted-foreground">
                                    Sin pagos registrados.
                                </p>
                            ) : (
                                <div className="grid gap-3">
                                    <ul className="grid gap-3">
                                        {payments.map((payment) => (
                                            <li
                                                key={payment.id}
                                                className="flex items-start justify-between gap-4"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[0.9375rem]">
                                                        {payment.method_label}
                                                    </p>
                                                    {payment.reference && (
                                                        <p className="text-sm break-words text-muted-foreground">
                                                            {payment.reference}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[0.9375rem] whitespace-nowrap tabular-nums">
                                                    {formatMoney(
                                                        payment.amount,
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-[0.9375rem] font-semibold">
                                        <span>Total pagado</span>
                                        <span className="tabular-nums">
                                            {formatMoney(totalPaid)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="Comprobante electrónico">
                            <div className="grid gap-4">
                                <p className="text-sm text-muted-foreground">
                                    La emisión de factura o boleta electrónica
                                    se habilita en la siguiente fase.
                                </p>
                                <Button
                                    variant="outline"
                                    className="h-10 w-full sm:w-auto sm:justify-self-start"
                                    disabled
                                >
                                    <FileText />
                                    Emitir comprobante
                                </Button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </PageContainer>

            {can.void && (
                <VoidSaleDialog
                    sale={sale}
                    open={voidOpen}
                    onOpenChange={setVoidOpen}
                />
            )}
        </>
    );
}

SaleShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Ventas', href: salesIndex() },
        { title: props.sale.code, href: show(props.sale.id) },
    ],
});
