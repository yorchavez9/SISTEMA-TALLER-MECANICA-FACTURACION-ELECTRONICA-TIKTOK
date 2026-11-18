import { Head, Link, useForm } from '@inertiajs/react';
import { Info, TriangleAlert } from 'lucide-react';
import type { FormEvent } from 'react';
import { PlanSelector } from '@/components/admin/company-shared';
import type { Environment } from '@/components/admin/company-shared';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { DocumentLookupButton } from '@/components/forms/document-lookup-button';
import type { DocumentLookupResult } from '@/components/forms/document-lookup-button';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import { UbigeoFields } from '@/components/forms/ubigeo-fields';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
    create,
    index as companiesIndex,
    store,
} from '@/routes/admin/companies';
import type { ApiPlan, Option } from '@/types';

type Props = {
    plans: ApiPlan[];
    taxRegimes: Option[];
    defaultEnvironment: Environment;
    passwordRules: string;
};

const ENVIRONMENT_OPTIONS: Option[] = [
    { value: 'beta', label: 'Beta (pruebas)' },
    { value: 'production', label: 'Producción' },
];

const NRUS_OPTIONS: Option[] = [
    { value: '1', label: 'Categoría 1' },
    { value: '2', label: 'Categoría 2' },
];

export default function CompaniesCreate({
    plans,
    taxRegimes,
    defaultEnvironment,
    passwordRules,
}: Props) {
    const form = useForm({
        ruc: '',
        legal_name: '',
        trade_name: '',
        email: '',
        phone: '',
        fiscal_address: '',
        ubigeo: '',
        department: '',
        province: '',
        district: '',
        tax_regime: taxRegimes[0]?.value ?? '',
        nrus_category: '',
        api_plan: plans[0]?.slug ?? '',
        environment: defaultEnvironment as string,
        admin_first_name: '',
        admin_last_name: '',
        admin_email: '',
        admin_password: '',
        admin_password_confirmation: '',
    });

    const { data, setData, errors, processing } = form;
    const apiError = (errors as Record<string, string | undefined>).api;

    const fillFromLookup = (result: DocumentLookupResult) => {
        form.setData((current) => ({
            ...current,
            legal_name: result.name ?? current.legal_name,
            trade_name: result.trade_name ?? current.trade_name,
            fiscal_address: result.address ?? current.fiscal_address,
            ubigeo: result.ubigeo ?? current.ubigeo,
            department: result.department ?? current.department,
            province: result.province ?? current.province,
            district: result.district ?? current.district,
        }));
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((values) => ({
            ...values,
            nrus_category:
                values.tax_regime === 'rus' ? values.nrus_category : '',
        }));
        form.post(store.url(), {
            preserveScroll: true,
            onError: () =>
                form.reset('admin_password', 'admin_password_confirmation'),
        });
    };

    return (
        <>
            <Head title="Nuevo taller" />

            <PageContainer className="max-w-4xl">
                <PageHeader
                    title="Nuevo taller"
                    description="Registre la empresa, su plan en la API de facturación y el primer administrador."
                />

                <form onSubmit={submit} className="grid gap-6">
                    <Alert>
                        <Info />
                        <AlertDescription className="text-[0.9375rem]">
                            El certificado digital y la Clave SOL se ingresan en
                            la siguiente pantalla, al registrar el taller en la
                            API de facturación.
                        </AlertDescription>
                    </Alert>

                    {apiError && (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertDescription className="text-[0.9375rem]">
                                {apiError}
                            </AlertDescription>
                        </Alert>
                    )}

                    <SectionCard
                        title="Datos del emisor"
                        description="Datos fiscales tal como figuran en SUNAT."
                    >
                        <div className="grid gap-5">
                            <FormField
                                label="RUC"
                                htmlFor="ruc"
                                error={errors.ruc}
                                hint="11 dígitos. Use “Buscar” para completar los datos."
                                required
                            >
                                <div className="flex gap-2">
                                    <Input
                                        id="ruc"
                                        value={data.ruc}
                                        onChange={(e) =>
                                            setData(
                                                'ruc',
                                                e.target.value
                                                    .replace(/\D/g, '')
                                                    .slice(0, 11),
                                            )
                                        }
                                        inputMode="numeric"
                                        maxLength={11}
                                        className="h-10 tabular-nums"
                                        autoComplete="off"
                                        aria-invalid={!!errors.ruc || undefined}
                                    />
                                    <DocumentLookupButton
                                        type="6"
                                        number={data.ruc}
                                        onFound={fillFromLookup}
                                        disabled={processing}
                                    />
                                </div>
                            </FormField>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <FormField
                                    label="Razón social"
                                    htmlFor="legal_name"
                                    error={errors.legal_name}
                                    required
                                >
                                    <Input
                                        id="legal_name"
                                        value={data.legal_name}
                                        onChange={(e) =>
                                            setData(
                                                'legal_name',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={255}
                                        className="h-10"
                                    />
                                </FormField>
                                <FormField
                                    label="Nombre comercial"
                                    htmlFor="trade_name"
                                    error={errors.trade_name}
                                >
                                    <Input
                                        id="trade_name"
                                        value={data.trade_name}
                                        onChange={(e) =>
                                            setData(
                                                'trade_name',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={150}
                                        className="h-10"
                                    />
                                </FormField>
                                <FormField
                                    label="Correo de la empresa"
                                    htmlFor="email"
                                    error={errors.email}
                                >
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData('email', e.target.value)
                                        }
                                        maxLength={255}
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
                                        value={data.phone}
                                        onChange={(e) =>
                                            setData('phone', e.target.value)
                                        }
                                        maxLength={30}
                                        className="h-10"
                                    />
                                </FormField>
                            </div>

                            <FormField
                                label="Dirección fiscal"
                                htmlFor="fiscal_address"
                                error={errors.fiscal_address}
                                required
                            >
                                <Input
                                    id="fiscal_address"
                                    value={data.fiscal_address}
                                    onChange={(e) =>
                                        setData(
                                            'fiscal_address',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={255}
                                    className="h-10"
                                />
                            </FormField>

                            <UbigeoFields
                                value={{
                                    ubigeo: data.ubigeo,
                                    department: data.department,
                                    province: data.province,
                                    district: data.district,
                                }}
                                onChange={(value) =>
                                    setData((current) => ({
                                        ...current,
                                        ...value,
                                    }))
                                }
                                errors={{
                                    ubigeo: errors.ubigeo,
                                    department: errors.department,
                                    province: errors.province,
                                    district: errors.district,
                                }}
                                lookupsAvailable={true}
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
                                        value={data.tax_regime}
                                        onChange={(value) =>
                                            setData('tax_regime', value)
                                        }
                                        options={taxRegimes}
                                    />
                                </FormField>
                                {data.tax_regime === 'rus' && (
                                    <FormField
                                        label="Categoría NRUS"
                                        htmlFor="nrus_category"
                                        error={errors.nrus_category}
                                        required
                                    >
                                        <SelectInput
                                            id="nrus_category"
                                            value={data.nrus_category}
                                            onChange={(value) =>
                                                setData('nrus_category', value)
                                            }
                                            options={NRUS_OPTIONS}
                                        />
                                    </FormField>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Plan y entorno"
                        description="Plan contratado en la API de facturación y entorno de emisión."
                    >
                        <div className="grid gap-5">
                            {plans.length > 0 ? (
                                <div className="grid gap-2">
                                    <p className="text-[0.9375rem] font-medium">
                                        Plan{' '}
                                        <span
                                            className="text-destructive-foreground"
                                            aria-hidden
                                        >
                                            *
                                        </span>
                                    </p>
                                    <PlanSelector
                                        plans={plans}
                                        value={data.api_plan}
                                        onChange={(slug) =>
                                            setData('api_plan', slug)
                                        }
                                        disabled={processing}
                                    />
                                    <InputError message={errors.api_plan} />
                                </div>
                            ) : (
                                <FormField
                                    label="Plan"
                                    htmlFor="api_plan"
                                    error={errors.api_plan}
                                    hint="No se pudo obtener la lista de planes de la API. Escriba el identificador del plan (por ejemplo, “basico”)."
                                    required
                                >
                                    <Input
                                        id="api_plan"
                                        value={data.api_plan}
                                        onChange={(e) =>
                                            setData(
                                                'api_plan',
                                                e.target.value.trim(),
                                            )
                                        }
                                        maxLength={30}
                                        className="h-10"
                                        autoComplete="off"
                                    />
                                </FormField>
                            )}

                            <FormField
                                label="Entorno"
                                htmlFor="environment"
                                error={errors.environment}
                                hint={
                                    data.environment === 'beta'
                                        ? 'En beta los comprobantes son de prueba y no tienen validez tributaria.'
                                        : undefined
                                }
                                required
                                className="sm:max-w-sm"
                            >
                                <SelectInput
                                    id="environment"
                                    value={data.environment}
                                    onChange={(value) =>
                                        setData('environment', value)
                                    }
                                    options={ENVIRONMENT_OPTIONS}
                                />
                            </FormField>

                            {data.environment === 'production' && (
                                <Alert>
                                    <TriangleAlert className="text-warning-foreground" />
                                    <AlertDescription className="text-[0.9375rem] text-warning-foreground">
                                        En producción los comprobantes se envían
                                        a SUNAT y tienen validez tributaria
                                        real. Se recomienda empezar en beta y
                                        cambiar a producción después de las
                                        pruebas.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard
                        title="Administrador del taller"
                        description="Usuario que gestionará el taller. Podrá crear más usuarios después."
                    >
                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Nombres"
                                htmlFor="admin_first_name"
                                error={errors.admin_first_name}
                                required
                            >
                                <Input
                                    id="admin_first_name"
                                    value={data.admin_first_name}
                                    onChange={(e) =>
                                        setData(
                                            'admin_first_name',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={100}
                                    className="h-10"
                                    autoComplete="off"
                                />
                            </FormField>
                            <FormField
                                label="Apellidos"
                                htmlFor="admin_last_name"
                                error={errors.admin_last_name}
                                required
                            >
                                <Input
                                    id="admin_last_name"
                                    value={data.admin_last_name}
                                    onChange={(e) =>
                                        setData(
                                            'admin_last_name',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={100}
                                    className="h-10"
                                    autoComplete="off"
                                />
                            </FormField>
                            <FormField
                                label="Correo"
                                htmlFor="admin_email"
                                error={errors.admin_email}
                                hint="Con este correo iniciará sesión."
                                required
                                className="sm:col-span-2"
                            >
                                <Input
                                    id="admin_email"
                                    type="email"
                                    value={data.admin_email}
                                    onChange={(e) =>
                                        setData('admin_email', e.target.value)
                                    }
                                    maxLength={255}
                                    className="h-10"
                                    autoComplete="off"
                                />
                            </FormField>
                            <FormField
                                label="Contraseña"
                                htmlFor="admin_password"
                                error={errors.admin_password}
                                required
                            >
                                <PasswordInput
                                    id="admin_password"
                                    value={data.admin_password}
                                    onChange={(e) =>
                                        setData(
                                            'admin_password',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                    className="h-10"
                                />
                            </FormField>
                            <FormField
                                label="Confirmar contraseña"
                                htmlFor="admin_password_confirmation"
                                error={errors.admin_password_confirmation}
                                required
                            >
                                <PasswordInput
                                    id="admin_password_confirmation"
                                    value={data.admin_password_confirmation}
                                    onChange={(e) =>
                                        setData(
                                            'admin_password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                    className="h-10"
                                />
                            </FormField>
                        </div>
                    </SectionCard>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button asChild variant="outline" disabled={processing}>
                            <Link href={companiesIndex()}>Cancelar</Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            Registrar taller
                        </Button>
                    </div>
                </form>
            </PageContainer>
        </>
    );
}

CompaniesCreate.layout = {
    breadcrumbs: [
        { title: 'Talleres', href: companiesIndex() },
        { title: 'Nuevo taller', href: create() },
    ],
};
