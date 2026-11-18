import { Deferred, router, useForm } from '@inertiajs/react';
import { TriangleAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    formatDateOnly,
    PlanSelector,
} from '@/components/admin/company-shared';
import type {
    BillingDetail,
    CompanyDetail,
    SubscriptionOverview,
} from '@/components/admin/company-shared';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { plan as planRoute } from '@/routes/admin/companies/billing';
import { cancel } from '@/routes/admin/companies/billing/subscription';
import type { ApiPlan, Option } from '@/types';

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
    plans: ApiPlan[];
    subscription?: SubscriptionOverview;
};

const CYCLE_OPTIONS: Option[] = [
    { value: 'monthly', label: 'Mensual' },
    { value: 'yearly', label: 'Anual' },
];

export function CompanyPlanTab({
    company,
    billing,
    plans,
    subscription,
}: Props) {
    const connected = billing?.connected ?? false;
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [submitting, setSubmitting] = useState<'change' | 'activate' | null>(
        null,
    );
    const form = useForm({
        plan: company.api_plan ?? plans[0]?.slug ?? '',
        cycle: 'monthly',
        action: 'change' as 'change' | 'activate',
        trial: false,
    });
    const apiError = (form.errors as Record<string, string | undefined>).api;

    const submit = (action: 'change' | 'activate') => {
        setSubmitting(action);
        form.transform((data) => ({
            ...data,
            action,
            trial: action === 'activate' ? data.trial : false,
        }));
        form.post(planRoute.url(company.id), {
            preserveScroll: true,
            onFinish: () => setSubmitting(null),
        });
    };

    const confirmCancel = () => {
        setCancelling(true);
        router.post(
            cancel.url(company.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setCancelling(false);
                    setCancelOpen(false);
                },
            },
        );
    };

    return (
        <div className="grid gap-6">
            <SectionCard
                title="Plan de la API"
                description={
                    connected
                        ? 'Cambie el plan de la suscripción vigente o active una nueva suscripción.'
                        : 'El taller aún no está registrado en la API: el plan se aplicará al registrarlo.'
                }
                footer={
                    connected ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => submit('change')}
                                disabled={form.processing || !form.data.plan}
                            >
                                {submitting === 'change' && <Spinner />}
                                Cambiar plan
                            </Button>
                            <Button
                                onClick={() => submit('activate')}
                                disabled={form.processing || !form.data.plan}
                            >
                                {submitting === 'activate' && <Spinner />}
                                Activar suscripción
                            </Button>
                        </>
                    ) : (
                        <Button
                            onClick={() => submit('change')}
                            disabled={form.processing || !form.data.plan}
                        >
                            {form.processing && <Spinner />}
                            Asignar plan
                        </Button>
                    )
                }
            >
                <div className="grid gap-5">
                    <p className="text-[0.9375rem]">
                        Plan actual:{' '}
                        <span className="font-medium">
                            {company.api_plan ?? 'Sin plan'}
                        </span>
                    </p>

                    {plans.length > 0 ? (
                        <div className="grid gap-2">
                            <PlanSelector
                                plans={plans}
                                value={form.data.plan}
                                current={company.api_plan}
                                onChange={(slug) => form.setData('plan', slug)}
                                name="plan"
                                disabled={form.processing}
                            />
                            <InputError message={form.errors.plan} />
                        </div>
                    ) : (
                        <FormField
                            label="Plan"
                            htmlFor="plan_slug"
                            error={form.errors.plan}
                            hint="No se pudo obtener la lista de planes de la API. Escriba el identificador del plan."
                            required
                        >
                            <Input
                                id="plan_slug"
                                value={form.data.plan}
                                onChange={(e) =>
                                    form.setData('plan', e.target.value.trim())
                                }
                                maxLength={30}
                                className="h-10 sm:max-w-sm"
                                autoComplete="off"
                            />
                        </FormField>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
                        <FormField
                            label="Ciclo de facturación"
                            htmlFor="cycle"
                            error={form.errors.cycle}
                            required
                        >
                            <SelectInput
                                id="cycle"
                                value={form.data.cycle}
                                onChange={(value) =>
                                    form.setData('cycle', value)
                                }
                                options={CYCLE_OPTIONS}
                            />
                        </FormField>
                        {connected && (
                            <div className="flex min-h-10 items-center gap-2">
                                <Checkbox
                                    id="trial"
                                    checked={form.data.trial}
                                    onCheckedChange={(checked) =>
                                        form.setData('trial', checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="trial"
                                    className="text-[0.9375rem] font-normal"
                                >
                                    Con prueba de 14 días (solo al activar)
                                </Label>
                            </div>
                        )}
                    </div>

                    {apiError && (
                        <Alert variant="destructive">
                            <TriangleAlert />
                            <AlertDescription className="text-[0.9375rem] break-words">
                                {apiError}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </SectionCard>

            {connected && (
                <SectionCard
                    title="Suscripción en la API"
                    description="Información consultada a la API de facturación en este momento."
                    action={
                        <Button
                            variant="destructive"
                            onClick={() => setCancelOpen(true)}
                        >
                            <XCircle />
                            Cancelar suscripción
                        </Button>
                    }
                >
                    <Deferred
                        data="subscription"
                        fallback={<SubscriptionSkeleton />}
                    >
                        <SubscriptionPanel overview={subscription ?? null} />
                    </Deferred>
                </SectionCard>
            )}

            <ConfirmDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                title="¿Cancelar la suscripción?"
                description="El taller dejará de poder emitir comprobantes cuando termine el periodo pagado. Podrá activar una nueva suscripción más adelante."
                confirmLabel="Cancelar suscripción"
                cancelLabel="Volver"
                variant="destructive"
                processing={cancelling}
                onConfirm={confirmCancel}
            />
        </div>
    );
}

function SubscriptionSkeleton() {
    return (
        <div className="grid gap-3" aria-label="Cargando suscripción">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/5" />
        </div>
    );
}

function SubscriptionPanel({ overview }: { overview: SubscriptionOverview }) {
    if (!overview) {
        return (
            <p className="text-[0.9375rem] text-muted-foreground">
                El taller no está registrado en la API.
            </p>
        );
    }

    const payments = Array.isArray(overview.payments)
        ? overview.payments
        : null;

    return (
        <div className="grid gap-6">
            {overview.error && (
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertDescription className="text-[0.9375rem] break-words">
                        No se pudo consultar toda la información:{' '}
                        {overview.error}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="grid content-start gap-3">
                    <h3 className="font-medium">Suscripción</h3>
                    <KeyValueList
                        value={overview.subscription}
                        empty="Sin suscripción activa."
                    />
                </div>
                <div className="grid content-start gap-3">
                    <h3 className="font-medium">Uso del periodo</h3>
                    <KeyValueList
                        value={overview.usage}
                        empty="Sin datos de uso."
                    />
                </div>
            </div>

            <div className="grid gap-3">
                <h3 className="font-medium">Pagos</h3>
                {!payments || payments.length === 0 ? (
                    <p className="text-[0.9375rem] text-muted-foreground">
                        Sin pagos registrados.
                    </p>
                ) : (
                    <ul className="grid gap-3">
                        {payments.map((payment, i) => (
                            <li key={i} className="rounded-lg border p-4">
                                <KeyValueList value={payment} empty="—" />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

/* ---------- Renderizado genérico (la forma de la respuesta no está documentada) ---------- */

const numberFormat = new Intl.NumberFormat('es-PE', {
    maximumFractionDigits: 2,
});

function humanizeKey(key: string): string {
    const text = key
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatScalar(value: unknown): ReactNode {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }

    if (typeof value === 'number') {
        return (
            <span className="tabular-nums">
                {value === -1 ? 'Ilimitado' : numberFormat.format(value)}
            </span>
        );
    }

    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return formatDateOnly(value);
        }

        if (
            /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) &&
            !Number.isNaN(Date.parse(value))
        ) {
            return formatDateTime(value);
        }

        return value;
    }

    if (Array.isArray(value)) {
        return value.every((v) => v === null || typeof v !== 'object')
            ? value.map((v) => String(v)).join(', ')
            : `${value.length} elementos`;
    }

    return JSON.stringify(value);
}

/** Aplana un nivel de objetos anidados: { limites: { docs: 1 } } → "Limites · docs". */
function flatten(
    value: Record<string, unknown>,
): { key: string; value: unknown }[] {
    const rows: { key: string; value: unknown }[] = [];

    Object.entries(value).forEach(([key, v]) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            Object.entries(v as Record<string, unknown>).forEach(
                ([subKey, subValue]) => {
                    rows.push({
                        key: `${humanizeKey(key)} · ${humanizeKey(subKey)}`,
                        value: subValue,
                    });
                },
            );
        } else {
            rows.push({ key: humanizeKey(key), value: v });
        }
    });

    return rows;
}

function KeyValueList({ value, empty }: { value: unknown; empty: string }) {
    if (
        value === null ||
        value === undefined ||
        (typeof value === 'object' && Object.keys(value as object).length === 0)
    ) {
        return (
            <p className="text-[0.9375rem] text-muted-foreground">{empty}</p>
        );
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return (
            <p className="text-[0.9375rem] break-words">
                {formatScalar(value)}
            </p>
        );
    }

    const rows = flatten(value as Record<string, unknown>);

    return (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {rows.map((row) => (
                <div key={row.key} className="contents">
                    <dt className="text-sm break-words text-muted-foreground">
                        {row.key}
                    </dt>
                    <dd className="mb-2 text-[0.9375rem] break-words sm:mb-0">
                        {formatScalar(row.value)}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
