import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { DocumentLookupButton } from '@/components/forms/document-lookup-button';
import type { DocumentLookupResult } from '@/components/forms/document-lookup-button';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { store, update } from '@/routes/customers';
import type { Option } from '@/types';

export type CustomerRow = {
    id: number;
    document_type: string;
    document_number: string | null;
    document_label: string;
    name: string;
    trade_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    vehicles_count: number | null;
    notes?: string | null;
    created_at?: string | null;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Cliente a editar; si no se indica, se registra uno nuevo. */
    customer?: CustomerRow | null;
    documentTypes: Option[];
    lookupsAvailable: boolean;
};

type CustomerFormData = {
    document_type: string;
    document_number: string;
    name: string;
    trade_name: string;
    address: string;
    phone: string;
    email: string;
    notes: string;
};

const EMPTY: CustomerFormData = {
    document_type: '1',
    document_number: '',
    name: '',
    trade_name: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
};

const NUMBER_LENGTH: Record<string, number> = { '1': 8, '6': 11 };

function fromCustomer(customer: CustomerRow): CustomerFormData {
    return {
        document_type: customer.document_type,
        document_number: customer.document_number ?? '',
        name: customer.name ?? '',
        trade_name: customer.trade_name ?? '',
        address: customer.address ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        notes: customer.notes ?? '',
    };
}

/**
 * Diálogo para registrar o editar un cliente (persona o empresa).
 */
export function CustomerFormDialog({
    open,
    onOpenChange,
    customer,
    documentTypes,
    lookupsAvailable,
}: Props) {
    const form = useForm<CustomerFormData>({ ...EMPTY });
    const errors = form.errors as Record<string, string>;
    const editing = !!customer;

    const type = form.data.document_type;
    const withoutDocument = type === '0';
    const isRuc = type === '6';
    const numericLength = NUMBER_LENGTH[type];
    const canLookup = lookupsAvailable && (type === '1' || type === '6');

    useEffect(() => {
        if (open) {
            form.clearErrors();
            form.setData(customer ? fromCustomer(customer) : { ...EMPTY });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, customer]);

    const changeType = (value: string) => {
        form.setData((data) => ({
            ...data,
            document_type: value,
            document_number:
                value === '0'
                    ? ''
                    : NUMBER_LENGTH[value]
                      ? data.document_number
                            .replace(/\D/g, '')
                            .slice(0, NUMBER_LENGTH[value])
                      : data.document_number,
            trade_name: value === '6' ? data.trade_name : '',
        }));
    };

    const changeNumber = (raw: string) => {
        const value = numericLength
            ? raw.replace(/\D/g, '').slice(0, numericLength)
            : raw.toUpperCase().replace(/\s/g, '').slice(0, 15);

        form.setData('document_number', value);
    };

    const applyLookup = (result: DocumentLookupResult) => {
        form.setData((data) => ({
            ...data,
            name: result.name ?? data.name,
            address: result.address ?? data.address,
            trade_name: isRuc ? (result.trade_name ?? data.trade_name) : '',
        }));
    };

    const close = (next: boolean) => {
        if (!form.processing) {
            onOpenChange(next);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
            },
        };

        if (customer) {
            form.put(update.url(customer.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Editar cliente' : 'Nuevo cliente'}
                        </DialogTitle>
                        <DialogDescription>
                            {editing
                                ? 'Actualice los datos del cliente.'
                                : 'Registre los datos del cliente para sus órdenes y comprobantes.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                        <FormField
                            label="Tipo de documento"
                            htmlFor="customer_document_type"
                            error={errors.document_type}
                            required
                        >
                            <SelectInput
                                id="customer_document_type"
                                value={form.data.document_type}
                                onChange={changeType}
                                options={documentTypes}
                                invalid={!!errors.document_type}
                            />
                        </FormField>

                        {!withoutDocument && (
                            <FormField
                                label="Número de documento"
                                htmlFor="customer_document_number"
                                error={errors.document_number}
                                required
                            >
                                <div className="flex gap-2">
                                    <Input
                                        id="customer_document_number"
                                        value={form.data.document_number}
                                        onChange={(e) =>
                                            changeNumber(e.target.value)
                                        }
                                        inputMode={
                                            numericLength ? 'numeric' : 'text'
                                        }
                                        maxLength={numericLength ?? 15}
                                        autoComplete="off"
                                        aria-invalid={
                                            !!errors.document_number ||
                                            undefined
                                        }
                                        className="h-10 min-w-0 uppercase tabular-nums"
                                    />
                                    {canLookup && (
                                        <DocumentLookupButton
                                            type={type as '1' | '6'}
                                            number={form.data.document_number}
                                            onFound={applyLookup}
                                            disabled={form.processing}
                                        />
                                    )}
                                </div>
                            </FormField>
                        )}
                    </div>

                    <FormField
                        label="Nombre o razón social"
                        htmlFor="customer_name"
                        error={errors.name}
                        required
                    >
                        <Input
                            id="customer_name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            maxLength={255}
                            autoComplete="off"
                            aria-invalid={!!errors.name || undefined}
                            className="h-10"
                        />
                    </FormField>

                    {isRuc && (
                        <FormField
                            label="Nombre comercial"
                            htmlFor="customer_trade_name"
                            error={errors.trade_name}
                        >
                            <Input
                                id="customer_trade_name"
                                value={form.data.trade_name}
                                onChange={(e) =>
                                    form.setData('trade_name', e.target.value)
                                }
                                maxLength={255}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                    )}

                    <FormField
                        label="Dirección"
                        htmlFor="customer_address"
                        error={errors.address}
                    >
                        <Input
                            id="customer_address"
                            value={form.data.address}
                            onChange={(e) =>
                                form.setData('address', e.target.value)
                            }
                            maxLength={255}
                            autoComplete="off"
                            className="h-10"
                        />
                    </FormField>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Teléfono"
                            htmlFor="customer_phone"
                            error={errors.phone}
                        >
                            <Input
                                id="customer_phone"
                                type="tel"
                                inputMode="tel"
                                value={form.data.phone}
                                onChange={(e) =>
                                    form.setData('phone', e.target.value)
                                }
                                maxLength={30}
                                autoComplete="off"
                                aria-invalid={!!errors.phone || undefined}
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <FormField
                            label="Correo"
                            htmlFor="customer_email"
                            error={errors.email}
                        >
                            <Input
                                id="customer_email"
                                type="email"
                                value={form.data.email}
                                onChange={(e) =>
                                    form.setData('email', e.target.value)
                                }
                                maxLength={255}
                                autoComplete="off"
                                aria-invalid={!!errors.email || undefined}
                                className="h-10"
                            />
                        </FormField>
                    </div>

                    <FormField
                        label="Notas"
                        htmlFor="customer_notes"
                        error={errors.notes}
                    >
                        <Textarea
                            id="customer_notes"
                            value={form.data.notes}
                            onChange={(e) =>
                                form.setData('notes', e.target.value)
                            }
                            maxLength={2000}
                            rows={3}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <InputError message={errors.api} />

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => close(false)}
                            disabled={form.processing}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {editing ? 'Guardar cambios' : 'Registrar cliente'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
