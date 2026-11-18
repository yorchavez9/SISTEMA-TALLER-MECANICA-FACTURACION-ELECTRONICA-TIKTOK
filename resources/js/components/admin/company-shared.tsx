import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/app/status-badge';
import type { StatusTone } from '@/components/app/status-badge';
import { cn } from '@/lib/utils';
import type { ApiPlan, BillingStatus } from '@/types';

export type Environment = 'beta' | 'production';

export type CompanyDetail = {
    id: number;
    uuid: string;
    ruc: string;
    legal_name: string;
    trade_name: string | null;
    email: string | null;
    phone: string | null;
    status: 'active' | 'suspended';
    api_plan: string | null;
    logo_url: string | null;
    created_at: string | null;
};

export type BillingDetail = {
    status: BillingStatus;
    status_label: string;
    connected: boolean;
    environment: Environment | null;
    environment_changed_at: string | null;
    tax_regime: string | null;
    igv_rate: string | number | null;
    igv_rate_override: string | number | null;
    sunat_client_id: string | null;
    fiscal_address: string | null;
    ubigeo: string | null;
    district: string | null;
    province: string | null;
    department: string | null;
    provisioned_at: string | null;
    last_synced_at: string | null;
    last_validated_at: string | null;
    last_error: string | null;
    certificate_uploaded_at: string | null;
    certificate_valid_to: string | null;
};

export type CompanyStats = {
    users: number;
    establishments: number;
    series: number;
};

export type CompanyAdmin = {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
};

export type SubscriptionOverview = {
    subscription: unknown;
    usage: unknown;
    payments: unknown[] | null;
    error: string | null;
} | null;

const BILLING_TONES: Record<
    BillingStatus,
    { tone: StatusTone; label: string }
> = {
    ready: { tone: 'success', label: 'Listo' },
    provisioning_error: { tone: 'danger', label: 'Error de registro' },
    not_configured: { tone: 'warning', label: 'Sin configurar' },
};

export function BillingStatusBadge({
    status,
    label,
}: {
    status: BillingStatus | null;
    label?: string | null;
}) {
    if (!status) {
        return <StatusBadge tone="neutral">Sin configurar</StatusBadge>;
    }

    const config = BILLING_TONES[status];

    return (
        <StatusBadge tone={config.tone}>
            {status === 'ready' ? config.label : (label ?? config.label)}
        </StatusBadge>
    );
}

export function EnvironmentBadge({
    environment,
}: {
    environment: Environment | null;
}) {
    if (!environment) {
        return <span className="text-muted-foreground">—</span>;
    }

    return environment === 'production' ? (
        <StatusBadge tone="success">Producción</StatusBadge>
    ) : (
        <StatusBadge tone="warning">Beta</StatusBadge>
    );
}

export function environmentLabel(environment: Environment | null): string {
    if (environment === 'production') {
        return 'Producción';
    }

    return environment === 'beta' ? 'Beta (pruebas)' : '—';
}

const moneyFormat = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat('es-PE');

export function formatMoney(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    const n = Number(value);

    return Number.isFinite(n) ? `S/ ${moneyFormat.format(n)}` : String(value);
}

export function formatNumber(value: number): string {
    return numberFormat.format(value);
}

/** Busca un límite del plan entre varios nombres posibles (la API no documenta las claves). */
function planLimit(plan: ApiPlan, keys: string[]): number | undefined {
    for (const key of keys) {
        const value = plan.limites[key];

        if (typeof value === 'number') {
            return value;
        }
    }

    return undefined;
}

function formatLimit(value: number | undefined): string {
    if (value === undefined) {
        return '—';
    }

    return value === -1 ? 'Ilimitado' : numberFormat.format(value);
}

type PlanSelectorProps = {
    plans: ApiPlan[];
    value: string;
    onChange: (slug: string) => void;
    /** Plan vigente (se marca como "Actual"). */
    current?: string | null;
    disabled?: boolean;
    name?: string;
};

/**
 * Lista de planes de la API como tarjetas seleccionables (radio).
 */
export function PlanSelector({
    plans,
    value,
    onChange,
    current,
    disabled,
    name = 'api_plan',
}: PlanSelectorProps) {
    return (
        <div
            role="radiogroup"
            aria-label="Plan de la API"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
            {plans.map((plan) => {
                const selected = plan.slug === value;
                const documents = planLimit(plan, [
                    'documents_month',
                    'documentos_mes',
                    'comprobantes_mes',
                    'documentos',
                ]);
                const branches = planLimit(plan, [
                    'sucursales',
                    'branches',
                    'establecimientos',
                ]);

                return (
                    <label
                        key={plan.slug}
                        className={cn(
                            'relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50',
                            selected &&
                                'border-primary bg-primary/5 hover:bg-primary/5',
                            disabled && 'cursor-not-allowed opacity-60',
                        )}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={plan.slug}
                            checked={selected}
                            disabled={disabled}
                            onChange={() => onChange(plan.slug)}
                            className="sr-only"
                        />
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-medium">{plan.nombre}</p>
                                <p className="text-sm text-muted-foreground">
                                    {plan.slug}
                                </p>
                            </div>
                            {selected ? (
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Check className="size-3.5" />
                                </span>
                            ) : (
                                <span className="size-5 shrink-0 rounded-full border" />
                            )}
                        </div>
                        <p className="text-[0.9375rem] font-semibold tabular-nums">
                            {plan.precio_mensual !== null
                                ? `${formatMoney(plan.precio_mensual)} / mes`
                                : 'Precio no informado'}
                        </p>
                        <dl className="grid gap-1 text-sm text-muted-foreground">
                            <div className="flex justify-between gap-2">
                                <dt>Comprobantes al mes</dt>
                                <dd className="text-foreground tabular-nums">
                                    {formatLimit(documents)}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt>Sucursales</dt>
                                <dd className="text-foreground tabular-nums">
                                    {formatLimit(branches)}
                                </dd>
                            </div>
                        </dl>
                        {current === plan.slug && (
                            <span className="text-sm font-medium text-link">
                                Plan actual
                            </span>
                        )}
                    </label>
                );
            })}
        </div>
    );
}

/** Lista de datos etiqueta → valor. */
export function DetailList({
    items,
    className,
}: {
    items: { label: string; value: ReactNode }[];
    className?: string;
}) {
    return (
        <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
            {items.map((item) => (
                <div key={item.label} className="min-w-0">
                    <dt className="text-sm text-muted-foreground">
                        {item.label}
                    </dt>
                    <dd className="text-[0.9375rem] break-words">
                        {item.value ?? '—'}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** Días hasta una fecha (negativo si ya pasó). */
export function daysUntil(date: string | null): number | null {
    if (!date) {
        return null;
    }

    const target = new Date(`${date.slice(0, 10)}T23:59:59-05:00`).getTime();

    return Math.floor((target - Date.now()) / 86400000);
}

const dateFormat = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeZone: 'America/Lima',
});

/** Formatea una fecha "YYYY-MM-DD" sin desplazamiento de zona horaria. */
export function formatDateOnly(date: string | null): string {
    if (!date) {
        return '—';
    }

    return dateFormat.format(new Date(`${date.slice(0, 10)}T12:00:00-05:00`));
}
