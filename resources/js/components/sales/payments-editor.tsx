import { Plus, Trash2 } from 'lucide-react';
import { SelectInput } from '@/components/forms/select-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Option } from '@/types';

export type PaymentLine = {
    method: string;
    amount: string;
    reference: string;
};

type Props = {
    payments: PaymentLine[];
    onChange: (payments: PaymentLine[]) => void;
    /** Total a cobrar (con IGV). */
    total: number;
    methods: Option[];
    /** errors de Inertia: "payments", "payments.0.amount", etc. */
    errors?: Record<string, string | undefined>;
};

const NEEDS_REFERENCE = ['card', 'yape', 'plin', 'transfer'];

/**
 * Cobro con uno o varios métodos de pago. La suma debe igualar el total
 * (el backend lo valida de nuevo).
 */
export function PaymentsEditor({
    payments,
    onChange,
    total,
    methods,
    errors = {},
}: Props) {
    const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const difference = Math.round((total - paid) * 100) / 100;

    const update = (index: number, changes: Partial<PaymentLine>) =>
        onChange(
            payments.map((p, i) => (i === index ? { ...p, ...changes } : p)),
        );

    const add = () =>
        onChange([
            ...payments,
            {
                method: 'cash',
                amount: difference > 0 ? difference.toFixed(2) : '',
                reference: '',
            },
        ]);

    const remove = (index: number) =>
        onChange(payments.filter((_, i) => i !== index));

    return (
        <div className="grid gap-3">
            {payments.map((payment, index) => (
                <div
                    key={index}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-start"
                >
                    <SelectInput
                        value={payment.method}
                        onChange={(method) => update(index, { method })}
                        options={methods}
                        invalid={!!errors[`payments.${index}.method`]}
                    />
                    <div className="grid gap-1">
                        <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={payment.amount}
                            onChange={(e) =>
                                update(index, { amount: e.target.value })
                            }
                            aria-label="Monto"
                            placeholder="0.00"
                            className="h-10 text-right tabular-nums"
                            aria-invalid={
                                !!errors[`payments.${index}.amount`] ||
                                undefined
                            }
                        />
                    </div>
                    <Input
                        value={payment.reference}
                        onChange={(e) =>
                            update(index, { reference: e.target.value })
                        }
                        placeholder={
                            NEEDS_REFERENCE.includes(payment.method)
                                ? 'N.º de operación (opcional)'
                                : 'Referencia (opcional)'
                        }
                        maxLength={100}
                        className="h-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 justify-self-end text-destructive-foreground"
                        onClick={() => remove(index)}
                        aria-label="Quitar pago"
                        disabled={payments.length === 1}
                    >
                        <Trash2 />
                    </Button>
                    {errors[`payments.${index}.amount`] && (
                        <p className="text-sm text-destructive-foreground sm:col-span-4">
                            {errors[`payments.${index}.amount`]}
                        </p>
                    )}
                </div>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    type="button"
                    variant="outline"
                    onClick={add}
                    disabled={payments.length >= 10}
                >
                    <Plus />
                    Agregar otro método
                </Button>
                <div className="grid gap-0.5 text-right text-[0.9375rem]">
                    <span>
                        Cobrado:{' '}
                        <strong className="tabular-nums">
                            {formatMoney(paid)}
                        </strong>
                    </span>
                    <span
                        className={cn(
                            'text-sm tabular-nums',
                            Math.abs(difference) < 0.005
                                ? 'text-success-foreground'
                                : 'text-warning-foreground',
                        )}
                    >
                        {Math.abs(difference) < 0.005
                            ? 'Pago completo'
                            : difference > 0
                              ? `Falta ${formatMoney(difference)}`
                              : `Excede en ${formatMoney(-difference)}`}
                    </span>
                </div>
            </div>

            {errors.payments && (
                <p className="text-sm text-destructive-foreground">
                    {errors.payments}
                </p>
            )}
        </div>
    );
}
