import { Head, Link, useForm } from '@inertiajs/react';
import {
    CircleAlert,
    Plus,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { AsyncCombobox } from '@/components/forms/async-combobox';
import { CustomerCombobox } from '@/components/forms/customer-combobox';
import type { CustomerOption } from '@/components/forms/customer-combobox';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
import { PaymentsEditor } from '@/components/sales/payments-editor';
import type { PaymentLine } from '@/components/sales/payments-editor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import type {
    CatalogProduct,
    CatalogService,
} from '@/components/work-orders/types';
import { formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    products as catalogProducts,
    services as catalogServices,
} from '@/routes/catalog';
import { index as customersIndex } from '@/routes/customers';
import { create, index as salesIndex, store } from '@/routes/sales';
import type { Option } from '@/types';

type LineType = 'product' | 'service' | 'labor';

type SaleLine = {
    /** Clave local para React. */
    key: string;
    type: LineType;
    service_id: number | null;
    product_id: number | null;
    description: string;
    /** Solo informativo (repuestos). */
    code: string | null;
    unit: string;
    quantity: string;
    unit_price: string;
    /** Stock disponible al momento de agregar (repuestos). */
    stock: string | null;
};

type FormData = {
    customer_id: number | null;
    items: SaleLine[];
    payments: PaymentLine[];
    notes: string;
};

type Props = {
    paymentMethods: Option[];
    preselectedCustomer: CustomerOption | null;
};

const TYPE_OPTIONS: { value: LineType; label: string }[] = [
    { value: 'product', label: 'Repuesto' },
    { value: 'service', label: 'Servicio' },
    { value: 'labor', label: 'Mano de obra' },
];

const TYPE_LABELS: Record<LineType, string> = {
    product: 'Repuesto',
    service: 'Servicio',
    labor: 'Mano de obra',
};

const LINE_FIELDS = [
    'type',
    'product_id',
    'service_id',
    'description',
    'quantity',
    'unit_price',
] as const;

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

const lineTotal = (line: SaleLine) =>
    (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);

export default function SaleCreate({
    paymentMethods,
    preselectedCustomer,
}: Props) {
    const [customer, setCustomer] = useState<CustomerOption | null>(
        preselectedCustomer,
    );
    const [addType, setAddType] = useState<LineType>('product');
    // Mientras el usuario no edite los pagos, el pago en efectivo sigue al total.
    const [paymentsTouched, setPaymentsTouched] = useState(false);

    const form = useForm<FormData>({
        customer_id: preselectedCustomer?.id ?? null,
        items: [],
        payments: [{ method: 'cash', amount: '', reference: '' }],
        notes: '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const lines = form.data.items;

    const total = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
    const igv = round2(total - total / 1.18);

    useEffect(() => {
        if (paymentsTouched) {
            return;
        }

        form.setData((data) =>
            data.payments.length === 1
                ? {
                      ...data,
                      payments: [
                          {
                              ...data.payments[0],
                              amount: total > 0 ? total.toFixed(2) : '',
                          },
                      ],
                  }
                : data,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total, paymentsTouched]);

    const selectCustomer = (value: CustomerOption | null) => {
        setCustomer(value);
        form.setData('customer_id', value?.id ?? null);
        form.clearErrors('customer_id');
    };

    const setLines = (updater: (items: SaleLine[]) => SaleLine[]) =>
        form.setData((data) => ({ ...data, items: updater(data.items) }));

    const updateLine = (key: string, changes: Partial<SaleLine>) =>
        setLines((items) =>
            items.map((l) => (l.key === key ? { ...l, ...changes } : l)),
        );

    const removeLine = (key: string) =>
        setLines((items) => items.filter((l) => l.key !== key));

    /** Agrega una línea del catálogo; si ya existe, suma 1 a la cantidad. */
    const addCatalogLine = (
        type: 'product' | 'service',
        id: number,
        build: () => SaleLine,
    ) =>
        setLines((items) => {
            const field = type === 'product' ? 'product_id' : 'service_id';
            const existing = items.find(
                (l) => l.type === type && l[field] === id,
            );

            if (existing) {
                return items.map((l) =>
                    l === existing
                        ? {
                              ...l,
                              quantity: String(
                                  round2((Number(l.quantity) || 0) + 1),
                              ),
                          }
                        : l,
                );
            }

            return [...items, build()];
        });

    const addProduct = (item: CatalogProduct | null) => {
        if (!item) {
            return;
        }

        addCatalogLine('product', item.id, () => ({
            key: nextKey(),
            type: 'product',
            service_id: null,
            product_id: item.id,
            description: item.name,
            code: item.code,
            unit: item.unit,
            quantity: '1',
            unit_price: String(item.price),
            stock: String(item.stock),
        }));
    };

    const addService = (item: CatalogService | null) => {
        if (!item) {
            return;
        }

        addCatalogLine('service', item.id, () => ({
            key: nextKey(),
            type: 'service',
            service_id: item.id,
            product_id: null,
            description: item.name,
            code: null,
            unit: item.unit,
            quantity: '1',
            unit_price: String(item.price),
            stock: null,
        }));
    };

    const addLabor = () =>
        setLines((items) => [
            ...items,
            {
                key: nextKey(),
                type: 'labor',
                service_id: null,
                product_id: null,
                description: '',
                code: null,
                unit: 'ZZ',
                quantity: '1',
                unit_price: '',
                stock: null,
            },
        ]);

    const changePayments = (payments: PaymentLine[]) => {
        setPaymentsTouched(true);
        form.setData('payments', payments);
    };

    const canSubmit =
        form.data.customer_id !== null && lines.length > 0 && !form.processing;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!canSubmit) {
            return;
        }

        form.transform((data) => ({
            customer_id: data.customer_id,
            items: data.items.map((l) => ({
                type: l.type,
                service_id: l.type === 'service' ? l.service_id : null,
                product_id: l.type === 'product' ? l.product_id : null,
                description: l.description.trim() || null,
                quantity: l.quantity,
                unit_price: l.unit_price === '' ? null : l.unit_price,
            })),
            payments: data.payments,
            notes: data.notes.trim() || null,
        }));
        form.post(store.url(), { preserveScroll: true });
    };

    const lineErrors = (index: number): string[] =>
        LINE_FIELDS.map((f) => errors[`items.${index}.${f}`]).filter(
            (m): m is string => !!m,
        );

    return (
        <>
            <Head title="Nueva venta" />

            <PageContainer className="max-w-5xl">
                <PageHeader
                    title="Nueva venta"
                    description="Venta directa en mostrador. Precios con IGV incluido."
                />

                <form onSubmit={submit} className="grid min-w-0 gap-6">
                    {errors.stock && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertTitle>Stock insuficiente</AlertTitle>
                            <AlertDescription className="text-[0.9375rem]">
                                {errors.stock}
                            </AlertDescription>
                        </Alert>
                    )}

                    <SectionCard title="Cliente">
                        <FormField
                            label="Cliente"
                            htmlFor="customer_id"
                            error={errors.customer_id}
                            required
                            hint={
                                <>
                                    ¿No está registrado?{' '}
                                    <Link
                                        href={customersIndex()}
                                        className="text-link hover:underline"
                                    >
                                        Regístrelo en Clientes
                                    </Link>{' '}
                                    y vuelva a esta pantalla.
                                </>
                            }
                        >
                            <CustomerCombobox
                                id="customer_id"
                                value={customer}
                                onChange={selectCustomer}
                                invalid={!!errors.customer_id}
                            />
                        </FormField>
                    </SectionCard>

                    <SectionCard
                        title="Productos y servicios"
                        description="Busque en el catálogo o agregue mano de obra."
                    >
                        <div className="grid min-w-0 gap-5">
                            <div className="grid min-w-0 gap-3 rounded-lg border bg-muted/30 p-3">
                                <Label className="text-[0.9375rem]">
                                    Agregar
                                </Label>
                                <div
                                    role="radiogroup"
                                    aria-label="Tipo de ítem"
                                    className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1"
                                >
                                    {TYPE_OPTIONS.map((option) => {
                                        const active = option.value === addType;

                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() =>
                                                    setAddType(option.value)
                                                }
                                                className={cn(
                                                    'h-10 rounded-md px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                                    active
                                                        ? 'border bg-background text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {addType === 'product' && (
                                    <AsyncCombobox<CatalogProduct>
                                        id="add_product"
                                        url={catalogProducts.url()}
                                        value={null}
                                        onChange={addProduct}
                                        getLabel={(item) => item.name}
                                        placeholder="Buscar repuesto por nombre o código…"
                                        searchPlaceholder="Nombre o código"
                                        renderItem={(item) => (
                                            <div className="min-w-0">
                                                <p className="truncate">
                                                    {item.name}
                                                </p>
                                                <p className="truncate text-sm text-muted-foreground tabular-nums">
                                                    {item.code} · stock{' '}
                                                    {formatQuantity(item.stock)}{' '}
                                                    {item.unit} ·{' '}
                                                    {formatMoney(item.price)}
                                                </p>
                                            </div>
                                        )}
                                    />
                                )}

                                {addType === 'service' && (
                                    <AsyncCombobox<CatalogService>
                                        id="add_service"
                                        url={catalogServices.url()}
                                        value={null}
                                        onChange={addService}
                                        getLabel={(item) => item.name}
                                        placeholder="Buscar servicio…"
                                        searchPlaceholder="Nombre del servicio"
                                        renderItem={(item) => (
                                            <div className="flex min-w-0 items-baseline justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate">
                                                        {item.name}
                                                    </p>
                                                    {item.detail && (
                                                        <p className="truncate text-sm text-muted-foreground">
                                                            {item.detail}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="shrink-0 text-sm tabular-nums">
                                                    {formatMoney(item.price)}
                                                </span>
                                            </div>
                                        )}
                                    />
                                )}

                                {addType === 'labor' && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 w-full sm:w-auto sm:justify-self-start"
                                        onClick={addLabor}
                                    >
                                        <Plus />
                                        Agregar línea de mano de obra
                                    </Button>
                                )}
                            </div>

                            {lines.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
                                    <ShoppingCart className="size-6 text-muted-foreground" />
                                    <p className="text-[0.9375rem] text-muted-foreground">
                                        Aún no hay ítems en la venta.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid min-w-0 gap-3 md:gap-0">
                                    <div
                                        aria-hidden
                                        className="hidden gap-3 border-b px-1 pb-2 text-sm text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_2.5rem]"
                                    >
                                        <span>Descripción</span>
                                        <span className="text-right">
                                            Cantidad
                                        </span>
                                        <span className="text-right">
                                            Precio unit.
                                        </span>
                                        <span className="text-right">
                                            Importe
                                        </span>
                                        <span />
                                    </div>

                                    {lines.map((line, index) => (
                                        <LineRow
                                            key={line.key}
                                            line={line}
                                            errors={lineErrors(index)}
                                            onChange={(changes) =>
                                                updateLine(line.key, changes)
                                            }
                                            onRemove={() =>
                                                removeLine(line.key)
                                            }
                                        />
                                    ))}
                                </div>
                            )}

                            <InputError message={errors.items} />

                            {lines.length > 0 && (
                                <dl className="ml-auto grid w-full max-w-xs gap-1.5 text-[0.9375rem]">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            Op. gravada
                                        </dt>
                                        <dd className="tabular-nums">
                                            {formatMoney(round2(total - igv))}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            IGV (referencial)
                                        </dt>
                                        <dd className="tabular-nums">
                                            {formatMoney(igv)}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between gap-4 border-t pt-1.5 font-semibold">
                                        <dt>Total</dt>
                                        <dd className="tabular-nums">
                                            {formatMoney(total)}
                                        </dd>
                                    </div>
                                    <p className="text-right text-sm text-muted-foreground">
                                        El servidor recalcula los importes.
                                    </p>
                                </dl>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Cobro"
                        description="La suma de los pagos debe ser igual al total."
                    >
                        <PaymentsEditor
                            payments={form.data.payments}
                            onChange={changePayments}
                            total={total}
                            methods={paymentMethods}
                            errors={errors}
                        />
                    </SectionCard>

                    <SectionCard title="Notas">
                        <FormField
                            label="Notas (opcional)"
                            htmlFor="notes"
                            error={errors.notes}
                        >
                            <Textarea
                                id="notes"
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                                maxLength={2000}
                                rows={3}
                                className="text-[0.9375rem]"
                            />
                        </FormField>
                    </SectionCard>

                    <div className="z-10 flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:sticky md:bottom-4">
                        <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">
                                Total a cobrar
                            </p>
                            <p className="text-xl font-semibold tabular-nums">
                                {formatMoney(total)}
                            </p>
                        </div>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button variant="outline" className="h-10" asChild>
                                <Link href={salesIndex()}>Cancelar</Link>
                            </Button>
                            <Button
                                type="submit"
                                className="h-10"
                                disabled={!canSubmit}
                            >
                                {form.processing && <Spinner />}
                                Registrar venta
                            </Button>
                        </div>
                    </div>
                </form>
            </PageContainer>
        </>
    );
}

function LineRow({
    line,
    errors,
    onChange,
    onRemove,
}: {
    line: SaleLine;
    errors: string[];
    onChange: (changes: Partial<SaleLine>) => void;
    onRemove: () => void;
}) {
    const quantity = Number(line.quantity) || 0;
    const overStock =
        line.type === 'product' &&
        line.stock !== null &&
        quantity > Number(line.stock);
    const invalid = errors.length > 0;

    return (
        <div
            className={cn(
                'grid min-w-0 gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_7rem_8rem_7rem_2.5rem] md:items-start md:rounded-none md:border-0 md:border-b md:px-1 md:py-3',
                invalid && 'border-destructive md:border-destructive',
            )}
        >
            <div className="flex min-w-0 items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-1">
                    {line.type === 'labor' ? (
                        <Input
                            value={line.description}
                            onChange={(e) =>
                                onChange({ description: e.target.value })
                            }
                            placeholder="Descripción de la mano de obra"
                            aria-label="Descripción"
                            maxLength={255}
                            className="h-10 text-[0.9375rem]"
                            autoComplete="off"
                        />
                    ) : (
                        <p className="pt-2 text-[0.9375rem] font-medium break-words md:pt-2">
                            {line.description}
                        </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <StatusBadge
                            tone={
                                line.type === 'product' ? 'primary' : 'neutral'
                            }
                        >
                            {TYPE_LABELS[line.type]}
                        </StatusBadge>
                        {line.code && (
                            <span className="tabular-nums">{line.code}</span>
                        )}
                        {line.stock !== null && (
                            <span className="tabular-nums">
                                Stock: {formatQuantity(line.stock)} {line.unit}
                            </span>
                        )}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-destructive-foreground md:hidden"
                    onClick={onRemove}
                    aria-label="Quitar ítem"
                >
                    <Trash2 />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:contents">
                <div className="grid gap-1">
                    <Label className="text-sm text-muted-foreground md:sr-only">
                        Cantidad ({line.unit})
                    </Label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        min={0.001}
                        step={0.001}
                        value={line.quantity}
                        onChange={(e) => onChange({ quantity: e.target.value })}
                        aria-label="Cantidad"
                        className="h-10 text-right text-[0.9375rem] tabular-nums"
                    />
                </div>
                <div className="grid gap-1">
                    <Label className="text-sm text-muted-foreground md:sr-only">
                        Precio unit. (S/)
                    </Label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={line.unit_price}
                        onChange={(e) =>
                            onChange({ unit_price: e.target.value })
                        }
                        aria-label="Precio unitario"
                        placeholder="0.00"
                        className="h-10 text-right text-[0.9375rem] tabular-nums"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 md:block md:pt-2 md:text-right">
                <span className="text-sm text-muted-foreground md:hidden">
                    Importe
                </span>
                <span className="text-[0.9375rem] font-semibold tabular-nums">
                    {formatMoney(lineTotal(line))}
                </span>
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden size-10 text-destructive-foreground md:inline-flex"
                onClick={onRemove}
                aria-label="Quitar ítem"
            >
                <Trash2 />
            </Button>

            {(overStock || invalid) && (
                <div className="grid gap-1 md:col-span-5">
                    {overStock && (
                        <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            La cantidad supera el stock disponible (
                            {formatQuantity(line.stock)} {line.unit}). No se
                            podrá registrar la venta sin stock suficiente.
                        </p>
                    )}
                    {errors.map((message) => (
                        <p
                            key={message}
                            className="text-sm text-destructive-foreground"
                        >
                            {message}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}

SaleCreate.layout = {
    breadcrumbs: [
        { title: 'Ventas', href: salesIndex() },
        { title: 'Nueva venta', href: create() },
    ],
};
