import { router, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    ChevronDown,
    PlugZap,
    RefreshCw,
    ShieldCheck,
    TriangleAlert,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    daysUntil,
    DetailList,
    formatDateOnly,
} from '@/components/admin/company-shared';
import type {
    BillingDetail,
    CompanyDetail,
} from '@/components/admin/company-shared';
import { SectionCard } from '@/components/app/section-card';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    certificate,
    provision,
    sync,
    test,
} from '@/routes/admin/companies/billing';

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
};

const SECRETS_NOTE =
    'El certificado, su contraseña y la Clave SOL se envían a la API de facturación, que los valida y cifra; el sistema no los guarda.';

/** Pestaña "Registro en la API". */
export function CompanyRegistrationTab({ company, billing }: Props) {
    return billing?.connected ? (
        <ConnectedStatus company={company} billing={billing} />
    ) : (
        <ProvisionForm company={company} />
    );
}

function ProvisionForm({ company }: { company: CompanyDetail }) {
    const [fileKey, setFileKey] = useState(0);
    const [restOpen, setRestOpen] = useState(false);
    const form = useForm({
        certificate: null as File | null,
        certificate_password: '',
        sol_user: '',
        sol_pass: '',
        client_id: '',
        client_secret: '',
    });
    const apiError = (form.errors as Record<string, string | undefined>).api;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(provision.url(company.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                setFileKey((k) => k + 1);
            },
            onError: () =>
                form.reset('certificate_password', 'sol_pass', 'client_secret'),
        });
    };

    return (
        <form onSubmit={submit}>
            <SectionCard
                title="Registrar el taller en la API de facturación"
                description="El registro crea la empresa en la API, sube el certificado digital y sincroniza establecimientos y series. Es necesario para emitir comprobantes."
                footer={
                    <Button type="submit" disabled={form.processing}>
                        {form.processing ? <Spinner /> : <PlugZap />}
                        Registrar en la API
                    </Button>
                }
            >
                <div className="grid gap-5">
                    <Alert>
                        <ShieldCheck />
                        <AlertDescription className="text-[0.9375rem]">
                            {SECRETS_NOTE}
                        </AlertDescription>
                    </Alert>

                    {apiError && (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertDescription className="text-[0.9375rem] break-words">
                                {apiError}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Certificado digital"
                            htmlFor="provision_certificate"
                            error={form.errors.certificate}
                            hint="Archivo .pfx o .p12 (máx. 2 MB)."
                            required
                        >
                            <Input
                                key={fileKey}
                                id="provision_certificate"
                                type="file"
                                accept=".pfx,.p12"
                                onChange={(e) =>
                                    form.setData(
                                        'certificate',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                                className="h-10 text-[0.9375rem]"
                            />
                        </FormField>
                        <FormField
                            label="Contraseña del certificado"
                            htmlFor="provision_certificate_password"
                            error={form.errors.certificate_password}
                            required
                        >
                            <PasswordInput
                                id="provision_certificate_password"
                                value={form.data.certificate_password}
                                onChange={(e) =>
                                    form.setData(
                                        'certificate_password',
                                        e.target.value,
                                    )
                                }
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                        <FormField
                            label="Usuario SOL"
                            htmlFor="sol_user"
                            error={form.errors.sol_user}
                            hint="Usuario secundario de SUNAT Operaciones en Línea."
                            required
                        >
                            <Input
                                id="sol_user"
                                value={form.data.sol_user}
                                onChange={(e) =>
                                    form.setData(
                                        'sol_user',
                                        e.target.value.toUpperCase(),
                                    )
                                }
                                maxLength={50}
                                autoComplete="off"
                                className="h-10 uppercase"
                            />
                        </FormField>
                        <FormField
                            label="Clave SOL"
                            htmlFor="sol_pass"
                            error={form.errors.sol_pass}
                            required
                        >
                            <PasswordInput
                                id="sol_pass"
                                value={form.data.sol_pass}
                                onChange={(e) =>
                                    form.setData('sol_pass', e.target.value)
                                }
                                maxLength={100}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                    </div>

                    <Collapsible
                        open={restOpen}
                        onOpenChange={setRestOpen}
                        className="rounded-lg border"
                    >
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[0.9375rem] font-medium"
                            >
                                Credenciales API REST SUNAT (opcional)
                                <ChevronDown
                                    className={cn(
                                        'size-4 shrink-0 transition-transform',
                                        restOpen && 'rotate-180',
                                    )}
                                />
                            </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="grid gap-5 border-t px-4 py-4 sm:grid-cols-2">
                                <p className="text-sm text-muted-foreground sm:col-span-2">
                                    Solo si el taller usa el API REST de SUNAT
                                    (guías de remisión electrónicas, consultas).
                                    Puede configurarlas después en “Avanzado”.
                                </p>
                                <FormField
                                    label="Client ID"
                                    htmlFor="provision_client_id"
                                    error={form.errors.client_id}
                                >
                                    <Input
                                        id="provision_client_id"
                                        value={form.data.client_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'client_id',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={255}
                                        autoComplete="off"
                                        className="h-10"
                                    />
                                </FormField>
                                <FormField
                                    label="Client secret"
                                    htmlFor="provision_client_secret"
                                    error={form.errors.client_secret}
                                >
                                    <PasswordInput
                                        id="provision_client_secret"
                                        value={form.data.client_secret}
                                        onChange={(e) =>
                                            form.setData(
                                                'client_secret',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={255}
                                        autoComplete="off"
                                        className="h-10"
                                    />
                                </FormField>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </SectionCard>
        </form>
    );
}

function ConnectedStatus({
    company,
    billing,
}: {
    company: CompanyDetail;
    billing: BillingDetail;
}) {
    const { flash } = usePage();
    const checks = flash.connectionChecks;
    const [running, setRunning] = useState<'test' | 'sync' | null>(null);

    const run = (action: 'test' | 'sync') => {
        setRunning(action);
        router.post(
            (action === 'test' ? test : sync).url(company.id),
            {},
            { preserveScroll: true, onFinish: () => setRunning(null) },
        );
    };

    return (
        <div className="grid gap-6">
            <SectionCard
                title="Taller registrado en la API"
                description="El taller tiene credenciales de la API. Pruebe la conexión si hay problemas al emitir, o reintente la sincronización si el registro quedó incompleto."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => run('sync')}
                            disabled={running !== null}
                        >
                            {running === 'sync' ? <Spinner /> : <RefreshCw />}
                            Reintentar sincronización
                        </Button>
                        <Button
                            onClick={() => run('test')}
                            disabled={running !== null}
                        >
                            {running === 'test' ? <Spinner /> : <PlugZap />}
                            Probar conexión
                        </Button>
                    </>
                }
            >
                <DetailList
                    items={[
                        {
                            label: 'Registrado en la API',
                            value: formatDateTime(billing.provisioned_at),
                        },
                        {
                            label: 'Última sincronización',
                            value: formatDateTime(billing.last_synced_at),
                        },
                        {
                            label: 'Última validación',
                            value: formatDateTime(billing.last_validated_at),
                        },
                        { label: 'Estado', value: billing.status_label },
                    ]}
                />
            </SectionCard>

            {checks && checks.length > 0 && (
                <SectionCard title="Resultado de la prueba de conexión">
                    <ul className="grid gap-3">
                        {checks.map((check) => (
                            <li
                                key={check.name}
                                className="flex items-start gap-3"
                            >
                                {check.ok ? (
                                    <CheckCircle2
                                        className="mt-0.5 size-5 shrink-0 text-success-foreground"
                                        aria-label="Correcto"
                                    />
                                ) : (
                                    <XCircle
                                        className="mt-0.5 size-5 shrink-0 text-destructive-foreground"
                                        aria-label="Con problemas"
                                    />
                                )}
                                <div className="min-w-0">
                                    <p className="font-medium">{check.name}</p>
                                    {check.detail && (
                                        <p className="text-sm break-words text-muted-foreground">
                                            {check.detail}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}
        </div>
    );
}

/** Pestaña "Certificado". */
export function CompanyCertificateTab({ company, billing }: Props) {
    const connected = billing?.connected ?? false;
    const [fileKey, setFileKey] = useState(0);
    const form = useForm({
        certificate: null as File | null,
        certificate_password: '',
    });
    const apiError = (form.errors as Record<string, string | undefined>).api;
    const days = daysUntil(billing?.certificate_valid_to ?? null);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(certificate.url(company.id), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                form.reset();
                setFileKey((k) => k + 1);
            },
            onError: () => form.reset('certificate_password'),
        });
    };

    return (
        <div className="grid gap-6">
            <SectionCard title="Certificado digital vigente">
                <div className="grid gap-4">
                    <DetailList
                        items={[
                            {
                                label: 'Subido el',
                                value: formatDateTime(
                                    billing?.certificate_uploaded_at,
                                ),
                            },
                            {
                                label: 'Vence el',
                                value: formatDateOnly(
                                    billing?.certificate_valid_to ?? null,
                                ),
                            },
                        ]}
                    />
                    {days !== null && days < 0 && (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertDescription className="text-[0.9375rem]">
                                El certificado está vencido. El taller no puede
                                emitir comprobantes hasta subir uno nuevo.
                            </AlertDescription>
                        </Alert>
                    )}
                    {days !== null && days >= 0 && days < 30 && (
                        <Alert>
                            <TriangleAlert className="text-warning-foreground" />
                            <AlertDescription className="text-[0.9375rem] text-warning-foreground">
                                El certificado vence en{' '}
                                {days === 0
                                    ? 'menos de un día'
                                    : `${days} ${days === 1 ? 'día' : 'días'}`}
                                . Renuévelo cuanto antes.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </SectionCard>

            <form onSubmit={submit}>
                <SectionCard
                    title="Renovar certificado"
                    description={
                        connected
                            ? SECRETS_NOTE
                            : 'Primero registre el taller en la API (pestaña “Registro en la API”).'
                    }
                    footer={
                        <Button
                            type="submit"
                            disabled={!connected || form.processing}
                        >
                            {form.processing && <Spinner />}
                            Subir certificado
                        </Button>
                    }
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Certificado digital"
                            htmlFor="renew_certificate"
                            error={form.errors.certificate}
                            hint="Archivo .pfx o .p12 (máx. 2 MB)."
                            required
                        >
                            <Input
                                key={fileKey}
                                id="renew_certificate"
                                type="file"
                                accept=".pfx,.p12"
                                disabled={!connected}
                                onChange={(e) =>
                                    form.setData(
                                        'certificate',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                                className="h-10 text-[0.9375rem]"
                            />
                        </FormField>
                        <FormField
                            label="Contraseña del certificado"
                            htmlFor="renew_certificate_password"
                            error={form.errors.certificate_password}
                            required
                        >
                            <PasswordInput
                                id="renew_certificate_password"
                                value={form.data.certificate_password}
                                onChange={(e) =>
                                    form.setData(
                                        'certificate_password',
                                        e.target.value,
                                    )
                                }
                                disabled={!connected}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                        <InputError
                            message={apiError}
                            className="sm:col-span-2"
                        />
                    </div>
                </SectionCard>
            </form>
        </div>
    );
}
