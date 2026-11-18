import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
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
import { store, update } from '@/routes/services';
import type { Option } from '@/types';

export type ServiceRow = {
    id: number;
    name: string;
    description: string | null;
    price: string;
    igv_affectation: string;
    igv_affectation_label: string;
    sunat_product_code: string | null;
    subject_to_detraction: boolean;
    detraction_type_id: number | null;
    detraction_label: string | null;
    is_active: boolean;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    service?: ServiceRow | null;
    igvAffectations: Option[];
    detractionTypes: Option[];
};

/** Valor interno del select para "usar el tipo predeterminado" (se envía null). */
const DEFAULT_DETRACTION = '__default';

type ServiceFormData = {
    name: string;
    description: string;
    price: string;
    igv_affectation: string;
    sunat_product_code: string;
    subject_to_detraction: boolean;
    detraction_type_id: string;
    is_active: boolean;
};

const emptyData = (): ServiceFormData => ({
    name: '',
    description: '',
    price: '',
    igv_affectation: '10',
    sunat_product_code: '',
    subject_to_detraction: true,
    detraction_type_id: '',
    is_active: true,
});

const dataFrom = (service: ServiceRow): ServiceFormData => ({
    name: service.name,
    description: service.description ?? '',
    price: service.price,
    igv_affectation: service.igv_affectation,
    sunat_product_code: service.sunat_product_code ?? '',
    subject_to_detraction: service.subject_to_detraction,
    detraction_type_id: service.detraction_type_id
        ? String(service.detraction_type_id)
        : '',
    is_active: service.is_active,
});

export function ServiceFormDialog({
    open,
    onOpenChange,
    service = null,
    igvAffectations,
    detractionTypes,
}: Props) {
    const form = useForm<ServiceFormData>(emptyData());
    const errors = form.errors as Record<string, string>;
    const editing = service !== null;

    useEffect(() => {
        if (!open) {
            return;
        }

        form.clearErrors();
        form.setData(service ? dataFrom(service) : emptyData());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, service]);

    const submit = (e: FormEvent) => {
        e.preventDefault();

        form.transform((data) => ({
            ...data,
            description: data.description.trim() || null,
            sunat_product_code: data.sunat_product_code.trim() || null,
            detraction_type_id:
                data.subject_to_detraction && data.detraction_type_id
                    ? Number(data.detraction_type_id)
                    : null,
        }));

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
            },
        };

        if (service) {
            form.put(update.url(service.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => !form.processing && onOpenChange(next)}
        >
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Editar servicio' : 'Nuevo servicio'}
                        </DialogTitle>
                        <DialogDescription>
                            {editing
                                ? 'Actualice los datos del servicio.'
                                : 'Registre un servicio que el taller ofrece (mano de obra, mantenimiento, etc.).'}
                        </DialogDescription>
                    </DialogHeader>

                    <FormField
                        label="Nombre"
                        htmlFor="service_name"
                        error={errors.name}
                        required
                    >
                        <Input
                            id="service_name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            maxLength={150}
                            autoComplete="off"
                            className="h-10"
                        />
                    </FormField>

                    <FormField
                        label="Descripción"
                        htmlFor="service_description"
                        error={errors.description}
                    >
                        <Textarea
                            id="service_description"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            maxLength={2000}
                            rows={3}
                            className="text-[0.9375rem]"
                        />
                    </FormField>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Precio (con IGV)"
                            htmlFor="service_price"
                            error={errors.price}
                            required
                        >
                            <Input
                                id="service_price"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min={0}
                                value={form.data.price}
                                onChange={(e) =>
                                    form.setData('price', e.target.value)
                                }
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <FormField
                            label="Afectación IGV"
                            htmlFor="service_igv_affectation"
                            error={errors.igv_affectation}
                            required
                        >
                            <SelectInput
                                id="service_igv_affectation"
                                value={form.data.igv_affectation}
                                onChange={(value) =>
                                    form.setData('igv_affectation', value)
                                }
                                options={igvAffectations}
                                invalid={!!errors.igv_affectation}
                            />
                        </FormField>
                    </div>

                    <FormField
                        label="Código de producto SUNAT"
                        htmlFor="service_sunat_product_code"
                        error={errors.sunat_product_code}
                        hint="Catálogo SUNAT, ej. 78181500 mantenimiento de vehículos"
                    >
                        <Input
                            id="service_sunat_product_code"
                            value={form.data.sunat_product_code}
                            onChange={(e) =>
                                form.setData(
                                    'sunat_product_code',
                                    e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 8),
                                )
                            }
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="78181500"
                            autoComplete="off"
                            className="h-10 tabular-nums"
                        />
                    </FormField>

                    <div className="grid gap-3">
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="service_subject_to_detraction"
                                checked={form.data.subject_to_detraction}
                                onCheckedChange={(checked) =>
                                    form.setData(
                                        'subject_to_detraction',
                                        checked === true,
                                    )
                                }
                                className="mt-0.5"
                            />
                            <Label
                                htmlFor="service_subject_to_detraction"
                                className="text-[0.9375rem]"
                            >
                                Sujeto a detracción
                            </Label>
                        </div>

                        {form.data.subject_to_detraction && (
                            <FormField
                                label="Tipo de detracción"
                                htmlFor="service_detraction_type_id"
                                error={errors.detraction_type_id}
                                hint="Al emitir la factura se puede elegir otro tipo o cambiar el porcentaje."
                            >
                                <SelectInput
                                    id="service_detraction_type_id"
                                    value={
                                        form.data.detraction_type_id ||
                                        DEFAULT_DETRACTION
                                    }
                                    onChange={(value) =>
                                        form.setData(
                                            'detraction_type_id',
                                            value === DEFAULT_DETRACTION
                                                ? ''
                                                : value,
                                        )
                                    }
                                    options={[
                                        {
                                            value: DEFAULT_DETRACTION,
                                            label: 'Predeterminado del taller',
                                        },
                                        ...detractionTypes,
                                    ]}
                                    invalid={!!errors.detraction_type_id}
                                />
                            </FormField>
                        )}
                    </div>

                    <div className="flex items-start gap-3">
                        <Checkbox
                            id="service_is_active"
                            checked={form.data.is_active}
                            onCheckedChange={(checked) =>
                                form.setData('is_active', checked === true)
                            }
                            className="mt-0.5"
                        />
                        <div className="grid gap-1">
                            <Label
                                htmlFor="service_is_active"
                                className="text-[0.9375rem]"
                            >
                                Activo
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Los servicios inactivos no se ofrecen al
                                registrar órdenes ni ventas.
                            </p>
                        </div>
                    </div>

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
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {editing ? 'Guardar cambios' : 'Crear servicio'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
