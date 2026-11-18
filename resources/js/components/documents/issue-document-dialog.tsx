import { useForm } from '@inertiajs/react';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { issue } from '@/routes/documents';
import type { DocumentSale, EmissionOptions } from './types';

type IssueType = '01' | '03';

type FormData = {
    document_type: IssueType;
    series_id: string;
    detraction: {
        apply: boolean;
        type_id: string;
        rate: string;
        override_reason: string;
    };
};

type Props = {
    sale: DocumentSale;
    emission: EmissionOptions;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Desde este total SUNAT exige identificar al cliente en boletas. */
const RECEIPT_ID_THRESHOLD = 700;

const WARNING_ALERT = 'border-warning/40 bg-warning/10 text-warning-foreground';

function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function rateOf(emission: EmissionOptions, typeId: string): string {
    const type = emission.detractionTypes.find((t) => t.value === typeId);

    return type ? String(Number(type.rate)) : '';
}

function initialData(emission: EmissionOptions): FormData {
    const invoiceAllowed = emission.customer_has_ruc && !emission.nrus;
    const type: IssueType = invoiceAllowed ? '01' : '03';
    const suggestedTypeId =
        emission.detraction.type_id !== null
            ? String(emission.detraction.type_id)
            : '';
    const typeId = emission.detractionTypes.some(
        (t) => t.value === suggestedTypeId,
    )
        ? suggestedTypeId
        : (emission.detractionTypes[0]?.value ?? '');
    const rate =
        typeId === suggestedTypeId && emission.detraction.rate !== null
            ? String(Number(emission.detraction.rate))
            : rateOf(emission, typeId);

    return {
        document_type: type,
        series_id: emission.series[type][0]?.value ?? '',
        detraction: {
            apply: emission.detraction.suggested,
            type_id: typeId,
            rate,
            override_reason: '',
        },
    };
}

/**
 * Emite factura o boleta electrónica de la venta. La API de facturación
 * procesa el comprobante con SUNAT.
 */
export function IssueDocumentDialog({
    sale,
    emission,
    open,
    onOpenChange,
}: Props) {
    const form = useForm<FormData>(initialData(emission));
    const errors = form.errors as Record<string, string | undefined>;
    const { document_type: type, detraction } = form.data;

    const total = Number(sale.total) || 0;
    const invoiceBlockedReason = emission.nrus
        ? 'el régimen Nuevo RUS solo permite emitir boletas.'
        : !emission.customer_has_ruc
          ? 'el cliente no tiene RUC registrado.'
          : null;
    const seriesOptions = emission.series[type] ?? [];
    const showDetraction = type === '01' && emission.detraction.eligible;
    const applying = showDetraction && detraction.apply;
    const needsOverride =
        showDetraction && emission.detraction.suggested && !detraction.apply;
    const receiptNeedsId =
        type === '03' &&
        !emission.customer_identified &&
        total >= RECEIPT_ID_THRESHOLD;

    const rateNumber = Number(detraction.rate);
    const rateValid =
        detraction.rate !== '' && rateNumber > 0 && rateNumber <= 100;
    const detractionAmount = rateValid ? round2((total * rateNumber) / 100) : 0;
    const netAmount = round2(total - detractionAmount);

    const typeLabel = type === '01' ? 'factura' : 'boleta';

    useEffect(() => {
        if (open) {
            form.setData(initialData(emission));
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const close = () => {
        if (!form.processing) {
            onOpenChange(false);
        }
    };

    const chooseType = (next: IssueType) => {
        if (next === type) {
            return;
        }

        form.setData((data) => ({
            ...data,
            document_type: next,
            series_id: emission.series[next][0]?.value ?? '',
        }));
        form.clearErrors('document_type', 'series_id');
    };

    const setDetraction = (patch: Partial<FormData['detraction']>) => {
        form.setData((data) => ({
            ...data,
            detraction: { ...data.detraction, ...patch },
        }));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => {
            const sendDetraction =
                data.document_type === '01' && emission.detraction.eligible;
            const apply = data.detraction.apply;

            return {
                document_type: data.document_type,
                series_id: data.series_id ? Number(data.series_id) : null,
                detraction: sendDetraction
                    ? {
                          apply,
                          type_id:
                              apply && data.detraction.type_id
                                  ? Number(data.detraction.type_id)
                                  : null,
                          rate:
                              apply && data.detraction.rate !== ''
                                  ? Number(data.detraction.rate)
                                  : null,
                          override_reason:
                              !apply && emission.detraction.suggested
                                  ? data.detraction.override_reason.trim() ||
                                    null
                                  : null,
                      }
                    : null,
            };
        });

        form.post(issue.url(sale.id), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    const typeChoices: {
        value: IssueType;
        label: string;
        disabled: boolean;
    }[] = [
        { value: '01', label: 'Factura', disabled: !!invoiceBlockedReason },
        { value: '03', label: 'Boleta', disabled: false },
    ];

    const blocking = errors.document ?? errors.api;
    const generalDetractionError =
        errors.detraction ?? errors['detraction.apply'];
    const overrideMissing =
        needsOverride && detraction.override_reason.trim() === '';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid min-w-0 gap-5">
                    <DialogHeader>
                        <DialogTitle>Emitir comprobante</DialogTitle>
                        <DialogDescription className="text-[0.9375rem]">
                            Comprobante electrónico de la venta {sale.code}.
                        </DialogDescription>
                    </DialogHeader>

                    <dl className="grid gap-3 rounded-lg bg-muted/50 px-4 py-3 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                            <dt className="text-sm text-muted-foreground">
                                Cliente
                            </dt>
                            <dd className="text-[0.9375rem] font-medium break-words">
                                {sale.customer.name}
                            </dd>
                            <dd className="text-sm break-words text-muted-foreground tabular-nums">
                                {sale.customer.document}
                            </dd>
                        </div>
                        <div className="min-w-0 sm:text-right">
                            <dt className="text-sm text-muted-foreground">
                                Total (con IGV)
                            </dt>
                            <dd className="text-lg font-semibold tabular-nums">
                                {formatMoney(total)}
                            </dd>
                        </div>
                    </dl>

                    {blocking && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertDescription className="text-[0.9375rem]">
                                {blocking}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid min-w-0 gap-2">
                        <span
                            id="document_type_label"
                            className="text-[0.9375rem] font-medium"
                        >
                            Tipo de comprobante
                        </span>
                        <div
                            role="radiogroup"
                            aria-labelledby="document_type_label"
                            className="grid grid-cols-2 gap-2"
                        >
                            {typeChoices.map((choice) => {
                                const selected = type === choice.value;

                                return (
                                    <button
                                        key={choice.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        disabled={
                                            form.processing || choice.disabled
                                        }
                                        onClick={() => chooseType(choice.value)}
                                        className={cn(
                                            'h-11 rounded-lg border px-3 text-[0.9375rem] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                                            selected
                                                ? 'border-primary bg-primary/10 text-link'
                                                : 'bg-background hover:bg-muted',
                                        )}
                                    >
                                        {choice.label}
                                    </button>
                                );
                            })}
                        </div>
                        {invoiceBlockedReason && (
                            <p className="text-sm text-muted-foreground">
                                Factura no disponible: {invoiceBlockedReason}
                            </p>
                        )}
                        <InputError message={errors.document_type} />
                        {receiptNeedsId && (
                            <Alert className={WARNING_ALERT}>
                                <TriangleAlert />
                                <AlertDescription className="text-sm text-warning-foreground">
                                    Para boletas de{' '}
                                    {formatMoney(RECEIPT_ID_THRESHOLD)} o más,
                                    SUNAT exige identificar al cliente (DNI, RUC
                                    u otro documento). Actualice los datos del
                                    cliente antes de emitir; de lo contrario, la
                                    emisión será rechazada.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <FormField
                        label="Serie"
                        htmlFor="series_id"
                        error={errors.series_id}
                        hint={
                            seriesOptions.length === 0
                                ? 'No hay series activas para este tipo. Créelas en Configuración del taller → Series.'
                                : undefined
                        }
                        required
                    >
                        <SelectInput
                            id="series_id"
                            value={form.data.series_id}
                            onChange={(value) =>
                                form.setData('series_id', value)
                            }
                            options={seriesOptions}
                            disabled={
                                form.processing || seriesOptions.length === 0
                            }
                            invalid={!!errors.series_id}
                        />
                    </FormField>

                    {showDetraction && (
                        <fieldset className="grid min-w-0 gap-4 rounded-lg border px-4 pt-2 pb-4">
                            <legend className="px-1 text-[0.9375rem] font-medium">
                                Detracción (SPOT)
                            </legend>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="detraction_apply"
                                    checked={detraction.apply}
                                    onCheckedChange={(checked) =>
                                        setDetraction({
                                            apply: checked === true,
                                        })
                                    }
                                    disabled={form.processing}
                                    className="mt-0.5 size-5"
                                />
                                <div className="grid min-w-0 gap-1">
                                    <Label
                                        htmlFor="detraction_apply"
                                        className="text-[0.9375rem]"
                                    >
                                        Aplicar detracción
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {emission.detraction.suggested
                                            ? `Sugerida: el total supera ${formatMoney(emission.detraction.threshold)} y la venta incluye servicios sujetos a detracción.`
                                            : (emission.detraction.reason ??
                                              'No se sugiere para esta venta.')}
                                    </p>
                                </div>
                            </div>

                            {applying && (
                                <>
                                    <div className="grid min-w-0 gap-4 sm:grid-cols-[1fr_8rem]">
                                        <FormField
                                            label="Tipo de detracción"
                                            htmlFor="detraction_type_id"
                                            error={errors['detraction.type_id']}
                                            required
                                        >
                                            <SelectInput
                                                id="detraction_type_id"
                                                value={detraction.type_id}
                                                onChange={(value) =>
                                                    setDetraction({
                                                        type_id: value,
                                                        rate: rateOf(
                                                            emission,
                                                            value,
                                                        ),
                                                    })
                                                }
                                                options={
                                                    emission.detractionTypes
                                                }
                                                disabled={form.processing}
                                                invalid={
                                                    !!errors[
                                                        'detraction.type_id'
                                                    ]
                                                }
                                            />
                                        </FormField>
                                        <FormField
                                            label="Porcentaje (%)"
                                            htmlFor="detraction_rate"
                                            error={errors['detraction.rate']}
                                            required
                                        >
                                            <Input
                                                id="detraction_rate"
                                                type="number"
                                                inputMode="decimal"
                                                step="0.01"
                                                min="0.01"
                                                max="100"
                                                value={detraction.rate}
                                                onChange={(e) =>
                                                    setDetraction({
                                                        rate: e.target.value,
                                                    })
                                                }
                                                disabled={form.processing}
                                                aria-invalid={
                                                    !!errors[
                                                        'detraction.rate'
                                                    ] || undefined
                                                }
                                                className="h-10 text-[0.9375rem] tabular-nums"
                                            />
                                        </FormField>
                                    </div>

                                    <p className="rounded-md bg-muted/50 px-3 py-2 text-[0.9375rem] tabular-nums">
                                        Monto de detracción:{' '}
                                        <span className="font-semibold">
                                            {formatMoney(detractionAmount)}
                                        </span>{' '}
                                        · Neto a cobrar:{' '}
                                        <span className="font-semibold">
                                            {formatMoney(netAmount)}
                                        </span>
                                    </p>

                                    {emission.detraction.account ? (
                                        <p className="text-sm break-words text-muted-foreground">
                                            Cuenta de detracciones (Banco de la
                                            Nación):{' '}
                                            <span className="font-medium text-foreground tabular-nums">
                                                {emission.detraction.account}
                                            </span>
                                        </p>
                                    ) : (
                                        <Alert className={WARNING_ALERT}>
                                            <TriangleAlert />
                                            <AlertDescription className="text-sm text-warning-foreground">
                                                Configure la cuenta de
                                                detracciones en Configuración
                                                del taller → Detracción.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </>
                            )}

                            {needsOverride && (
                                <FormField
                                    label="Motivo para no aplicar"
                                    htmlFor="detraction_override_reason"
                                    error={errors['detraction.override_reason']}
                                    hint="La detracción está sugerida para esta venta; indique por qué no se aplica."
                                    required
                                >
                                    <Textarea
                                        id="detraction_override_reason"
                                        value={detraction.override_reason}
                                        onChange={(e) =>
                                            setDetraction({
                                                override_reason: e.target.value,
                                            })
                                        }
                                        rows={2}
                                        maxLength={255}
                                        disabled={form.processing}
                                        aria-invalid={
                                            !!errors[
                                                'detraction.override_reason'
                                            ] || undefined
                                        }
                                        className="text-[0.9375rem]"
                                    />
                                </FormField>
                            )}

                            <InputError message={generalDetractionError} />
                        </fieldset>
                    )}

                    <div className="grid gap-3">
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
                                disabled={
                                    form.processing ||
                                    seriesOptions.length === 0 ||
                                    overrideMissing ||
                                    (applying && !rateValid)
                                }
                            >
                                {form.processing && <Spinner />}
                                Emitir {typeLabel}
                            </Button>
                        </DialogFooter>
                        <p className="text-sm text-muted-foreground sm:text-right">
                            El comprobante se envía a la API de facturación, que
                            lo procesa con SUNAT. No cierre la ventana mientras
                            se emite.
                        </p>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
