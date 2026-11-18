import { useForm } from '@inertiajs/react';
import { ArrowLeftRight, Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    EnvironmentBadge,
    environmentLabel,
} from '@/components/admin/company-shared';
import type {
    BillingDetail,
    CompanyDetail,
    Environment,
} from '@/components/admin/company-shared';
import { SectionCard } from '@/components/app/section-card';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { formatDateTime } from '@/lib/format';
import {
    advanced,
    environment as environmentRoute,
} from '@/routes/admin/companies/billing';

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
};

/** Pestaña "Entorno". */
export function CompanyEnvironmentTab({ company, billing }: Props) {
    const current: Environment = billing?.environment ?? 'beta';
    const target: Environment = current === 'beta' ? 'production' : 'beta';
    const [open, setOpen] = useState(false);
    const form = useForm({ environment: target as string, confirmation: '' });
    const apiError = (form.errors as Record<string, string | undefined>).api;

    const openDialog = () => {
        form.clearErrors();
        form.setData({ environment: target, confirmation: '' });
        setOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(environmentRoute.url(company.id), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset();
            },
        });
    };

    return (
        <>
            <SectionCard
                title="Entorno de emisión"
                description="Define si los comprobantes del taller se envían al entorno de pruebas (beta) o a SUNAT con validez tributaria (producción)."
                footer={
                    <Button
                        variant={
                            target === 'production' ? 'default' : 'outline'
                        }
                        onClick={openDialog}
                        disabled={!billing}
                    >
                        <ArrowLeftRight />
                        Cambiar a {environmentLabel(target).toLowerCase()}
                    </Button>
                }
            >
                <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[0.9375rem]">
                            Entorno actual:
                        </span>
                        <EnvironmentBadge
                            environment={billing?.environment ?? null}
                        />
                    </div>
                    {billing?.environment_changed_at && (
                        <p className="text-sm text-muted-foreground">
                            Último cambio:{' '}
                            {formatDateTime(billing.environment_changed_at)}
                        </p>
                    )}
                    <ul className="grid gap-2 text-[0.9375rem] text-muted-foreground">
                        <li>
                            <span className="font-medium text-foreground">
                                Beta:
                            </span>{' '}
                            los comprobantes son de prueba, SUNAT no los
                            registra y no tienen validez tributaria. Úselo para
                            probar series, impresión y flujo de emisión.
                        </li>
                        <li>
                            <span className="font-medium text-foreground">
                                Producción:
                            </span>{' '}
                            cada comprobante se envía a SUNAT y tiene validez
                            tributaria real. No se puede “deshacer” un
                            comprobante emitido; solo anularlo con nota de
                            crédito o comunicación de baja.
                        </li>
                    </ul>
                    {!billing && (
                        <p className="text-sm text-muted-foreground">
                            El taller aún no tiene configuración de facturación.
                        </p>
                    )}
                </div>
            </SectionCard>

            <Dialog
                open={open}
                onOpenChange={(next) => !form.processing && setOpen(next)}
            >
                <DialogContent className="sm:max-w-lg">
                    <form onSubmit={submit} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>
                                Cambiar a{' '}
                                {environmentLabel(target).toLowerCase()}
                            </DialogTitle>
                            <DialogDescription className="text-[0.9375rem]">
                                {target === 'production'
                                    ? 'A partir del cambio, todos los comprobantes del taller se enviarán a SUNAT con validez tributaria.'
                                    : 'A partir del cambio, los comprobantes del taller serán de prueba y no tendrán validez tributaria.'}
                            </DialogDescription>
                        </DialogHeader>

                        {target === 'production' && (
                            <Alert>
                                <TriangleAlert className="text-warning-foreground" />
                                <AlertTitle className="text-warning-foreground">
                                    Antes de pasar a producción, verifique que:
                                </AlertTitle>
                                <AlertDescription className="text-[0.9375rem]">
                                    <ul className="list-disc space-y-1 pl-5">
                                        <li>
                                            El certificado digital está vigente.
                                        </li>
                                        <li>
                                            Las pruebas en beta fueron aceptadas
                                            por SUNAT.
                                        </li>
                                        <li>
                                            Las series de producción están
                                            creadas y listas.
                                        </li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        <FormField
                            label={`Escriba el RUC ${company.ruc} para confirmar`}
                            htmlFor="environment_confirmation"
                            error={
                                form.errors.confirmation ??
                                form.errors.environment
                            }
                            required
                        >
                            <Input
                                id="environment_confirmation"
                                value={form.data.confirmation}
                                onChange={(e) =>
                                    form.setData(
                                        'confirmation',
                                        e.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 11),
                                    )
                                }
                                inputMode="numeric"
                                autoComplete="off"
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <InputError message={apiError} />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={form.processing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant={
                                    target === 'production'
                                        ? 'destructive'
                                        : 'default'
                                }
                                disabled={
                                    form.processing ||
                                    form.data.confirmation !== company.ruc
                                }
                            >
                                {form.processing && <Spinner />}
                                Cambiar entorno
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Pestaña "Avanzado". */
export function CompanyAdvancedTab({ company, billing }: Props) {
    const connected = billing?.connected ?? false;
    const form = useForm({
        igv_rate_override:
            billing?.igv_rate_override !== null &&
            billing?.igv_rate_override !== undefined
                ? String(billing.igv_rate_override)
                : '',
        client_id: billing?.sunat_client_id ?? '',
        client_secret: '',
    });
    const apiError = (form.errors as Record<string, string | undefined>).api;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            ...data,
            igv_rate_override:
                data.igv_rate_override.trim() === ''
                    ? null
                    : data.igv_rate_override,
            client_secret:
                data.client_secret === '' ? null : data.client_secret,
        }));
        form.put(advanced.url(company.id), {
            preserveScroll: true,
            onSuccess: () => form.setData('client_secret', ''),
        });
    };

    return (
        <form onSubmit={submit}>
            <SectionCard
                title="Opciones avanzadas"
                description="Ajustes que normalmente no es necesario modificar."
                footer={
                    <Button
                        type="submit"
                        disabled={!connected || form.processing}
                    >
                        {form.processing && <Spinner />}
                        Guardar opciones
                    </Button>
                }
            >
                <div className="grid gap-5">
                    {!connected && (
                        <Alert>
                            <Info />
                            <AlertDescription className="text-[0.9375rem]">
                                Estas opciones se guardan en la API de
                                facturación. Primero registre el taller en la
                                API.
                            </AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        label="Tasa de IGV forzada (%)"
                        htmlFor="igv_rate_override"
                        error={form.errors.igv_rate_override}
                        hint={`Déjelo vacío para usar la tasa vigente${billing?.igv_rate ? ` (${billing.igv_rate} %)` : ''}. Solo para casos especiales (por ejemplo, la tasa reducida para restaurantes y hoteles MYPE).`}
                        className="sm:max-w-sm"
                    >
                        <Input
                            id="igv_rate_override"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            inputMode="decimal"
                            value={form.data.igv_rate_override}
                            onChange={(e) =>
                                form.setData(
                                    'igv_rate_override',
                                    e.target.value,
                                )
                            }
                            disabled={!connected}
                            className="h-10 tabular-nums"
                        />
                    </FormField>

                    <div className="grid gap-2">
                        <p className="font-medium">
                            Credenciales API REST de SUNAT
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Se usan para guías de remisión electrónicas y
                            consultas. El client secret no se muestra: escriba
                            uno nuevo solo si desea reemplazarlo.
                        </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Client ID"
                            htmlFor="advanced_client_id"
                            error={form.errors.client_id}
                        >
                            <Input
                                id="advanced_client_id"
                                value={form.data.client_id}
                                onChange={(e) =>
                                    form.setData('client_id', e.target.value)
                                }
                                maxLength={255}
                                disabled={!connected}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>
                        <FormField
                            label="Client secret"
                            htmlFor="advanced_client_secret"
                            error={form.errors.client_secret}
                        >
                            <PasswordInput
                                id="advanced_client_secret"
                                value={form.data.client_secret}
                                onChange={(e) =>
                                    form.setData(
                                        'client_secret',
                                        e.target.value,
                                    )
                                }
                                maxLength={255}
                                disabled={!connected}
                                autoComplete="off"
                                placeholder="Sin cambios"
                                className="h-10"
                            />
                        </FormField>
                    </div>

                    <InputError message={apiError} />
                </div>
            </SectionCard>
        </form>
    );
}
