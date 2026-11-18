import { useForm } from '@inertiajs/react';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
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
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { adjust } from '@/routes/products/stock';

type StockMode = 'add' | 'subtract' | 'set';

export type StockDialogProduct = {
    id: number;
    name: string;
    unit: string;
    stock: string;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: StockDialogProduct | null;
};

const MODES: { value: StockMode; label: string; icon: LucideIcon }[] = [
    { value: 'add', label: 'Entrada', icon: ArrowDownToLine },
    { value: 'subtract', label: 'Salida', icon: ArrowUpFromLine },
    {
        value: 'set',
        label: 'Conteo físico (fijar cantidad)',
        icon: ClipboardCheck,
    },
];

const REASON_PLACEHOLDERS: Record<StockMode, string> = {
    add: 'Ej. Compra a proveedor',
    subtract: 'Ej. Merma o consumo interno',
    set: 'Ej. Inventario',
};

type StockFormData = {
    mode: StockMode;
    quantity: string;
    reason: string;
};

export function ProductStockDialog({ open, onOpenChange, product }: Props) {
    const form = useForm<StockFormData>({
        mode: 'add',
        quantity: '',
        reason: '',
    });
    const errors = form.errors as Record<string, string>;

    useEffect(() => {
        if (open) {
            form.reset();
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, product?.id]);

    const current = Number(product?.stock ?? 0);
    const quantity =
        form.data.quantity === '' ? null : Number(form.data.quantity);
    const resulting =
        quantity === null || Number.isNaN(quantity)
            ? null
            : form.data.mode === 'add'
              ? current + quantity
              : form.data.mode === 'subtract'
                ? current - quantity
                : quantity;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!product) {
            return;
        }

        form.post(adjust.url(product.id), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
            },
        });
    };

    const unit = product?.unit ?? '';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => !form.processing && onOpenChange(next)}
        >
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>Ajustar stock</DialogTitle>
                        <DialogDescription className="break-words">
                            {product?.name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label className="text-[0.9375rem]">
                            Tipo de ajuste
                        </Label>
                        <div
                            role="radiogroup"
                            aria-label="Tipo de ajuste"
                            className="grid gap-2 sm:grid-cols-3"
                        >
                            {MODES.map((mode) => {
                                const selected = form.data.mode === mode.value;
                                const Icon = mode.icon;

                                return (
                                    <Button
                                        key={mode.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        variant={
                                            selected ? 'default' : 'outline'
                                        }
                                        onClick={() =>
                                            form.setData('mode', mode.value)
                                        }
                                        className="h-auto min-h-10 justify-start py-2 text-left whitespace-normal sm:justify-center sm:text-center"
                                    >
                                        <Icon />
                                        {mode.label}
                                    </Button>
                                );
                            })}
                        </div>
                        <InputError message={errors.mode} />
                    </div>

                    <FormField
                        label={
                            form.data.mode === 'set'
                                ? 'Cantidad contada'
                                : 'Cantidad'
                        }
                        htmlFor="stock_quantity"
                        error={errors.quantity}
                        hint={unit ? `En ${unit}` : undefined}
                        required
                    >
                        <Input
                            id="stock_quantity"
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            min={0}
                            value={form.data.quantity}
                            onChange={(e) =>
                                form.setData('quantity', e.target.value)
                            }
                            className="h-10 tabular-nums"
                            autoFocus
                        />
                    </FormField>

                    <FormField
                        label="Motivo"
                        htmlFor="stock_reason"
                        error={errors.reason}
                        required
                    >
                        <Input
                            id="stock_reason"
                            value={form.data.reason}
                            onChange={(e) =>
                                form.setData('reason', e.target.value)
                            }
                            placeholder={REASON_PLACEHOLDERS[form.data.mode]}
                            maxLength={200}
                            autoComplete="off"
                            className="h-10"
                        />
                    </FormField>

                    <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 text-[0.9375rem]">
                        <div className="min-w-0">
                            <dt className="text-sm text-muted-foreground">
                                Stock actual
                            </dt>
                            <dd className="font-medium tabular-nums">
                                {formatQuantity(current)} {unit}
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-sm text-muted-foreground">
                                Stock resultante
                            </dt>
                            <dd
                                className={cn(
                                    'font-medium tabular-nums',
                                    resulting !== null &&
                                        resulting < 0 &&
                                        'text-destructive-foreground',
                                )}
                            >
                                {resulting === null
                                    ? '—'
                                    : `${formatQuantity(resulting)} ${unit}`}
                            </dd>
                        </div>
                    </dl>

                    <InputError message={errors.api} />

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
                            disabled={form.processing || !product}
                        >
                            {form.processing && <Spinner />}
                            Guardar ajuste
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
