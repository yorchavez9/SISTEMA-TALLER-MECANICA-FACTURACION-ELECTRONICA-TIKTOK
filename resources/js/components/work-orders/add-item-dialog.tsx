import { useForm } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { AsyncCombobox } from '@/components/forms/async-combobox';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatMoney, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    products as catalogProducts,
    services as catalogServices,
} from '@/routes/catalog';
import { store as storeItem } from '@/routes/work-orders/items';
import type {
    CatalogProduct,
    CatalogService,
    WorkOrderItemType,
} from './types';

type Props = {
    orderId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type FormData = {
    type: WorkOrderItemType;
    service_id: number | null;
    product_id: number | null;
    description: string;
    quantity: string;
    unit_price: string;
};

const TYPE_OPTIONS: { value: WorkOrderItemType; label: string }[] = [
    { value: 'service', label: 'Servicio' },
    { value: 'product', label: 'Repuesto' },
    { value: 'labor', label: 'Mano de obra' },
];

const EMPTY: Omit<FormData, 'type'> = {
    service_id: null,
    product_id: null,
    description: '',
    quantity: '1',
    unit_price: '',
};

export function AddItemDialog({ orderId, open, onOpenChange }: Props) {
    const form = useForm<FormData>({ type: 'service', ...EMPTY });
    const [service, setService] = useState<CatalogService | null>(null);
    const [product, setProduct] = useState<CatalogProduct | null>(null);

    const { type } = form.data;
    const quantity = Number(form.data.quantity) || 0;
    const unitPrice = Number(form.data.unit_price) || 0;
    const lineTotal = quantity * unitPrice;
    const overStock =
        type === 'product' &&
        product !== null &&
        quantity > Number(product.stock);

    const changeType = (next: WorkOrderItemType) => {
        if (next === type) {
            return;
        }

        setService(null);
        setProduct(null);
        form.setData({ type: next, ...EMPTY });
        form.clearErrors();
    };

    const selectService = (item: CatalogService | null) => {
        setService(item);
        form.setData((data) => ({
            ...data,
            service_id: item?.id ?? null,
            description: item?.name ?? '',
            unit_price: item ? String(item.price) : '',
        }));
    };

    const selectProduct = (item: CatalogProduct | null) => {
        setProduct(item);
        form.setData((data) => ({
            ...data,
            product_id: item?.id ?? null,
            description: item?.name ?? '',
            unit_price: item ? String(item.price) : '',
        }));
    };

    const close = () => {
        if (!form.processing) {
            onOpenChange(false);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(storeItem.url(orderId), {
            preserveScroll: true,
            onSuccess: () => {
                setService(null);
                setProduct(null);
                form.setData({ type: form.data.type, ...EMPTY });
                form.clearErrors();
                onOpenChange(false);
            },
        });
    };

    const unit = type === 'product' ? (product?.unit ?? 'NIU') : 'ZZ';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>Agregar a la orden</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Precios con IGV incluido.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label className="text-[0.9375rem]">Tipo</Label>
                        <div
                            role="radiogroup"
                            aria-label="Tipo de ítem"
                            className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1"
                        >
                            {TYPE_OPTIONS.map((option) => {
                                const active = option.value === type;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => changeType(option.value)}
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
                    </div>

                    {type === 'service' && (
                        <FormField
                            label="Servicio"
                            htmlFor="item_service"
                            error={form.errors.service_id}
                            required
                        >
                            <AsyncCombobox<CatalogService>
                                id="item_service"
                                url={catalogServices.url()}
                                value={service}
                                onChange={selectService}
                                getLabel={(item) => item.name}
                                placeholder="Buscar servicio…"
                                searchPlaceholder="Nombre del servicio"
                                invalid={!!form.errors.service_id}
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
                        </FormField>
                    )}

                    {type === 'product' && (
                        <FormField
                            label="Repuesto"
                            htmlFor="item_product"
                            error={form.errors.product_id}
                            required
                        >
                            <AsyncCombobox<CatalogProduct>
                                id="item_product"
                                url={catalogProducts.url()}
                                value={product}
                                onChange={selectProduct}
                                getLabel={(item) =>
                                    `${item.name} · ${item.code}`
                                }
                                placeholder="Buscar repuesto…"
                                searchPlaceholder="Nombre o código"
                                invalid={!!form.errors.product_id}
                                renderItem={(item) => (
                                    <div className="min-w-0">
                                        <p className="truncate">{item.name}</p>
                                        <p className="truncate text-sm text-muted-foreground tabular-nums">
                                            {item.code} · stock{' '}
                                            {formatQuantity(item.stock)}{' '}
                                            {item.unit} ·{' '}
                                            {formatMoney(item.price)}
                                        </p>
                                    </div>
                                )}
                            />
                        </FormField>
                    )}

                    <FormField
                        label="Descripción"
                        htmlFor="item_description"
                        error={form.errors.description}
                        required={type === 'labor'}
                        hint={
                            type === 'labor'
                                ? 'Por ejemplo: "Mano de obra cambio de embrague".'
                                : 'Opcional. Si la deja vacía se usa el nombre del catálogo.'
                        }
                    >
                        <Input
                            id="item_description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            maxLength={255}
                            className="h-10 text-[0.9375rem]"
                            autoComplete="off"
                        />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            label={`Cantidad (${unit})`}
                            htmlFor="item_quantity"
                            error={form.errors.quantity}
                            required
                        >
                            <Input
                                id="item_quantity"
                                type="number"
                                inputMode="decimal"
                                min={0.001}
                                step={0.001}
                                value={form.data.quantity}
                                onChange={(e) =>
                                    form.setData('quantity', e.target.value)
                                }
                                className="h-10 text-[0.9375rem] tabular-nums"
                            />
                        </FormField>
                        <FormField
                            label="Precio unit. (S/)"
                            htmlFor="item_unit_price"
                            error={form.errors.unit_price}
                            required={type === 'labor'}
                        >
                            <Input
                                id="item_unit_price"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.01}
                                value={form.data.unit_price}
                                onChange={(e) =>
                                    form.setData('unit_price', e.target.value)
                                }
                                className="h-10 text-[0.9375rem] tabular-nums"
                            />
                        </FormField>
                    </div>

                    {overStock && product && (
                        <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            La cantidad supera el stock disponible (
                            {formatQuantity(product.stock)} {product.unit}).
                            Puede agregarlo igual; el stock se descuenta al
                            registrar la venta.
                        </p>
                    )}

                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-[0.9375rem]">
                        <span className="text-muted-foreground">
                            Importe de la línea
                        </span>
                        <span className="font-semibold tabular-nums">
                            {formatMoney(lineTotal)}
                        </span>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={close}
                            disabled={form.processing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="h-10"
                            disabled={form.processing}
                        >
                            {form.processing && <Spinner />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
