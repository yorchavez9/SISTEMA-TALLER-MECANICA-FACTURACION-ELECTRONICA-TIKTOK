import { Head, useForm } from '@inertiajs/react';
import { ImageOff, Info, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { SectionCard } from '@/components/app/section-card';
import type { DocumentLookupResult } from '@/components/forms/document-lookup-button';
import { DocumentLookupButton } from '@/components/forms/document-lookup-button';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import type { UbigeoValue } from '@/components/forms/ubigeo-fields';
import { UbigeoFields } from '@/components/forms/ubigeo-fields';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { update as logoUpdate } from '@/routes/company-settings/logo';
import { edit, update } from '@/routes/company-settings/profile';
import type { Option } from '@/types';

type Profile = {
    ruc: string;
    legal_name: string;
    trade_name: string | null;
    email: string | null;
    phone: string | null;
    logo_url: string | null;
    fiscal_address: string | null;
    ubigeo: string | null;
    department: string | null;
    province: string | null;
    district: string | null;
    tax_regime: string | null;
    nrus_category: string | null;
    thanks_message: string | null;
};

type Props = {
    profile: Profile;
    connected: boolean;
    lookupsAvailable: boolean;
    taxRegimes: Option[];
};

const NRUS_CATEGORIES: Option[] = [
    { value: '1', label: 'Categoría 1' },
    { value: '2', label: 'Categoría 2' },
];

const MAX_LOGO_BYTES = 1024 * 1024;

export default function CompanyProfilePage({
    profile,
    connected,
    lookupsAvailable,
    taxRegimes,
}: Props) {
    const form = useForm({
        ruc: profile.ruc ?? '',
        legal_name: profile.legal_name ?? '',
        trade_name: profile.trade_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        thanks_message: profile.thanks_message ?? '',
        fiscal_address: profile.fiscal_address ?? '',
        ubigeo: profile.ubigeo ?? '',
        department: profile.department ?? '',
        province: profile.province ?? '',
        district: profile.district ?? '',
        tax_regime: profile.tax_regime ?? '',
        nrus_category: profile.nrus_category ?? '',
    });

    const errors = form.errors as Record<string, string>;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            nrus_category:
                data.tax_regime === 'rus' ? data.nrus_category || null : null,
        }));
        form.put(update.url(), { preserveScroll: true });
    };

    const applyLookup = (result: DocumentLookupResult) => {
        form.setData((data) => ({
            ...data,
            legal_name: result.name ?? data.legal_name,
            trade_name: result.trade_name ?? data.trade_name,
            fiscal_address: result.address ?? data.fiscal_address,
            ubigeo: result.ubigeo ?? data.ubigeo,
            department: result.department ?? data.department,
            province: result.province ?? data.province,
            district: result.district ?? data.district,
        }));
    };

    const ubigeoValue: UbigeoValue = {
        ubigeo: form.data.ubigeo,
        department: form.data.department,
        province: form.data.province,
        district: form.data.district,
    };

    return (
        <>
            <Head title="Datos de la empresa" />

            <form onSubmit={submit} className="space-y-6">
                <SectionCard
                    title="Datos de la empresa"
                    description="Información del emisor que aparece en los comprobantes electrónicos."
                >
                    <div className="grid gap-5">
                        <FormField
                            label="RUC"
                            htmlFor="ruc"
                            error={errors.ruc}
                            hint={
                                connected
                                    ? 'No se puede cambiar: el taller ya está registrado en la API.'
                                    : undefined
                            }
                            required
                        >
                            <div className="flex gap-2">
                                <Input
                                    id="ruc"
                                    value={form.data.ruc}
                                    onChange={(e) =>
                                        form.setData(
                                            'ruc',
                                            e.target.value
                                                .replace(/\D/g, '')
                                                .slice(0, 11),
                                        )
                                    }
                                    disabled={connected}
                                    inputMode="numeric"
                                    maxLength={11}
                                    autoComplete="off"
                                    className="h-10 tabular-nums"
                                />
                                {!connected && (
                                    <DocumentLookupButton
                                        type="6"
                                        number={form.data.ruc}
                                        onFound={applyLookup}
                                    />
                                )}
                            </div>
                        </FormField>

                        <FormField
                            label="Razón social"
                            htmlFor="legal_name"
                            error={errors.legal_name}
                            required
                        >
                            <Input
                                id="legal_name"
                                value={form.data.legal_name}
                                onChange={(e) =>
                                    form.setData('legal_name', e.target.value)
                                }
                                maxLength={255}
                                className="h-10 uppercase"
                            />
                        </FormField>

                        <FormField
                            label="Nombre comercial"
                            htmlFor="trade_name"
                            error={errors.trade_name}
                        >
                            <Input
                                id="trade_name"
                                value={form.data.trade_name}
                                onChange={(e) =>
                                    form.setData('trade_name', e.target.value)
                                }
                                maxLength={150}
                                className="h-10"
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Correo"
                                htmlFor="email"
                                error={errors.email}
                            >
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) =>
                                        form.setData('email', e.target.value)
                                    }
                                    maxLength={255}
                                    autoComplete="email"
                                    className="h-10"
                                />
                            </FormField>

                            <FormField
                                label="Teléfono"
                                htmlFor="phone"
                                error={errors.phone}
                            >
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) =>
                                        form.setData('phone', e.target.value)
                                    }
                                    maxLength={30}
                                    autoComplete="tel"
                                    className="h-10"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Mensaje de agradecimiento"
                            htmlFor="thanks_message"
                            error={errors.thanks_message}
                            hint="Aparece en los comprobantes PDF."
                        >
                            <Textarea
                                id="thanks_message"
                                value={form.data.thanks_message}
                                onChange={(e) =>
                                    form.setData(
                                        'thanks_message',
                                        e.target.value,
                                    )
                                }
                                maxLength={200}
                                rows={3}
                                className="text-[0.9375rem]"
                            />
                        </FormField>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Dirección fiscal y régimen"
                    footer={
                        <>
                            <p className="mr-auto self-center text-sm text-muted-foreground">
                                {connected
                                    ? 'Al guardar, los cambios se envían a la API de facturación.'
                                    : 'Los datos se enviarán a la API cuando el super administrador registre el taller.'}
                            </p>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                Guardar cambios
                            </Button>
                        </>
                    }
                >
                    <div className="grid gap-5">
                        <FormField
                            label="Dirección fiscal"
                            htmlFor="fiscal_address"
                            error={errors.fiscal_address}
                            required
                        >
                            <Input
                                id="fiscal_address"
                                value={form.data.fiscal_address}
                                onChange={(e) =>
                                    form.setData(
                                        'fiscal_address',
                                        e.target.value,
                                    )
                                }
                                maxLength={255}
                                className="h-10 uppercase"
                            />
                        </FormField>

                        <UbigeoFields
                            value={ubigeoValue}
                            onChange={(value) =>
                                form.setData((data) => ({ ...data, ...value }))
                            }
                            errors={{
                                ubigeo: errors.ubigeo,
                                department: errors.department,
                                province: errors.province,
                                district: errors.district,
                            }}
                            lookupsAvailable={lookupsAvailable}
                        />

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Régimen tributario"
                                htmlFor="tax_regime"
                                error={errors.tax_regime}
                                required
                            >
                                <SelectInput
                                    id="tax_regime"
                                    value={form.data.tax_regime}
                                    onChange={(value) =>
                                        form.setData('tax_regime', value)
                                    }
                                    options={taxRegimes}
                                    invalid={!!errors.tax_regime}
                                />
                            </FormField>

                            {form.data.tax_regime === 'rus' && (
                                <FormField
                                    label="Categoría NRUS"
                                    htmlFor="nrus_category"
                                    error={errors.nrus_category}
                                    required
                                >
                                    <SelectInput
                                        id="nrus_category"
                                        value={form.data.nrus_category}
                                        onChange={(value) =>
                                            form.setData('nrus_category', value)
                                        }
                                        options={NRUS_CATEGORIES}
                                        invalid={!!errors.nrus_category}
                                    />
                                </FormField>
                            )}
                        </div>

                        {form.data.tax_regime === 'rus' && (
                            <Alert>
                                <Info />
                                <AlertDescription className="text-[0.9375rem]">
                                    En el Nuevo RUS solo se pueden emitir
                                    boletas de venta; no podrá emitir facturas.
                                </AlertDescription>
                            </Alert>
                        )}

                        <InputError message={errors.api} />
                    </div>
                </SectionCard>
            </form>

            <LogoCard logoUrl={profile.logo_url} />
        </>
    );
}

function LogoCard({ logoUrl }: { logoUrl: string | null }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const form = useForm<{ logo: File | null }>({ logo: null });
    const errors = form.errors as Record<string, string>;

    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const clearSelection = () => {
        setPreview(null);
        form.setData('logo', null);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setClientError(null);
        form.clearErrors();

        if (!file) {
            clearSelection();

            return;
        }

        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            setClientError('El logo debe ser una imagen PNG o JPG.');
            clearSelection();

            return;
        }

        if (file.size > MAX_LOGO_BYTES) {
            setClientError('El logo no debe superar 1 MB.');
            clearSelection();

            return;
        }

        form.setData('logo', file);
        setPreview(URL.createObjectURL(file));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (!form.data.logo) {
            return;
        }

        form.post(logoUpdate.url(), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => clearSelection(),
        });
    };

    const shown = preview ?? logoUrl;

    return (
        <SectionCard
            title="Logo"
            description="Aparece en los comprobantes PDF."
        >
            <form
                onSubmit={submit}
                className="flex flex-col gap-5 sm:flex-row sm:items-start"
            >
                <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {shown ? (
                        <img
                            src={shown}
                            alt="Logo de la empresa"
                            className="size-full object-contain"
                        />
                    ) : (
                        <ImageOff
                            className="size-8 text-muted-foreground"
                            aria-label="Sin logo"
                        />
                    )}
                </div>

                <div className="grid min-w-0 flex-1 gap-4">
                    <FormField
                        label="Archivo de imagen"
                        htmlFor="logo"
                        error={clientError ?? errors.logo}
                        hint="PNG o JPG, máximo 1 MB y 2000 × 2000 px."
                    >
                        <Input
                            ref={inputRef}
                            id="logo"
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={onFileChange}
                            className="h-10 text-[0.9375rem]"
                        />
                    </FormField>

                    <InputError message={errors.api} />

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            type="submit"
                            disabled={!form.data.logo || form.processing}
                        >
                            {form.processing ? <Spinner /> : <Upload />}
                            Subir logo
                        </Button>
                        {preview && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={clearSelection}
                                disabled={form.processing}
                            >
                                Descartar
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </SectionCard>
    );
}

CompanyProfilePage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: edit() },
        { title: 'Empresa', href: edit() },
    ],
};
