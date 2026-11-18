import { Deferred, Head, usePage } from '@inertiajs/react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { SectionCard } from '@/components/app/section-card';
import type { StatusTone } from '@/components/app/status-badge';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { billing as billingRoute } from '@/routes/company-settings';

type Billing = {
    status: string;
    status_label: string;
    connected: boolean;
    environment: string;
    plan: string | null;
    igv_rate: string | null;
    provisioned_at: string | null;
    last_synced_at: string | null;
    certificate_uploaded_at: string | null;
    certificate_valid_to: string | null;
    last_error: string | null;
};

type Props = {
    billing: Billing;
    /** Diferida. Su forma la define la API (no documentada): se muestra de forma genérica. */
    usage?: unknown;
};

const STATUS_TONES: Record<string, StatusTone> = {
    ready: 'success',
    not_configured: 'warning',
    provisioning_error: 'danger',
};

const dateFormat = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
});

/** Días que faltan para una fecha YYYY-MM-DD (negativo si ya pasó). */
function daysUntil(date: string): number {
    const target = Date.parse(`${date}T00:00:00Z`);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    return Math.round((target - today) / 86_400_000);
}

export default function BillingStatusPage({ billing }: Props) {
    const isBeta = billing.environment === 'beta';
    const certDays = billing.certificate_valid_to
        ? daysUntil(billing.certificate_valid_to)
        : null;

    return (
        <>
            <Head title="Facturación electrónica" />

            <SectionCard
                title="Estado de la facturación electrónica"
                description="Conexión del taller con la API de facturación electrónica (SUNAT)."
                action={
                    <StatusBadge
                        tone={STATUS_TONES[billing.status] ?? 'neutral'}
                    >
                        {billing.status_label}
                    </StatusBadge>
                }
            >
                <div className="grid gap-5">
                    {billing.last_error && (
                        <Alert variant="destructive">
                            <XCircle />
                            <AlertTitle>Último error de la API</AlertTitle>
                            <AlertDescription className="text-[0.9375rem] break-words">
                                {billing.last_error}
                            </AlertDescription>
                        </Alert>
                    )}

                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Item label="Entorno">
                            {isBeta ? (
                                <span className="grid gap-1">
                                    <span>
                                        <StatusBadge tone="warning">
                                            Beta (pruebas)
                                        </StatusBadge>
                                    </span>
                                    <span className="text-sm text-warning-foreground">
                                        Entorno de pruebas: los comprobantes no
                                        tienen validez tributaria.
                                    </span>
                                </span>
                            ) : billing.environment === 'production' ? (
                                <StatusBadge tone="success">
                                    Producción
                                </StatusBadge>
                            ) : (
                                billing.environment || '—'
                            )}
                        </Item>
                        <Item label="Plan">{billing.plan || '—'}</Item>
                        <Item label="IGV vigente">
                            {billing.igv_rate !== null
                                ? `${billing.igv_rate} %`
                                : '—'}
                        </Item>
                        <Item label="Registrado en la API">
                            {formatDateTime(billing.provisioned_at)}
                        </Item>
                        <Item label="Última sincronización">
                            {formatDateTime(billing.last_synced_at)}
                        </Item>
                    </dl>
                </div>
            </SectionCard>

            <SectionCard
                title="Certificado digital"
                description="Se usa para firmar los comprobantes electrónicos."
            >
                <div className="grid gap-5">
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Item label="Cargado el">
                            {formatDateTime(billing.certificate_uploaded_at)}
                        </Item>
                        <Item label="Válido hasta">
                            {billing.certificate_valid_to ? (
                                <span className="inline-flex flex-wrap items-center gap-2">
                                    <span className="tabular-nums">
                                        {dateFormat.format(
                                            new Date(
                                                `${billing.certificate_valid_to}T00:00:00Z`,
                                            ),
                                        )}
                                    </span>
                                    {certDays !== null && certDays < 0 && (
                                        <StatusBadge tone="danger">
                                            Vencido
                                        </StatusBadge>
                                    )}
                                    {certDays !== null &&
                                        certDays >= 0 &&
                                        certDays < 30 && (
                                            <StatusBadge tone="warning">
                                                {certDays === 0
                                                    ? 'Vence hoy'
                                                    : `Vence en ${certDays} ${certDays === 1 ? 'día' : 'días'}`}
                                            </StatusBadge>
                                        )}
                                </span>
                            ) : (
                                '—'
                            )}
                        </Item>
                    </dl>

                    {certDays !== null && certDays < 30 && (
                        <Alert
                            variant={certDays < 0 ? 'destructive' : 'default'}
                        >
                            <AlertTriangle />
                            <AlertDescription className="text-[0.9375rem]">
                                {certDays < 0
                                    ? 'El certificado digital está vencido: no se podrán emitir comprobantes hasta renovarlo. Comuníquese con el super administrador.'
                                    : 'El certificado digital vence pronto. Comuníquese con el super administrador para renovarlo a tiempo.'}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </SectionCard>

            <SectionCard
                title="Consumo del plan"
                description="Uso de comprobantes y recursos según los límites del plan."
            >
                <Deferred
                    data="usage"
                    fallback={
                        <div className="grid gap-3">
                            <Skeleton className="h-5 w-2/3" />
                            <Skeleton className="h-5 w-1/2" />
                            <Skeleton className="h-5 w-3/5" />
                        </div>
                    }
                >
                    <UsageList />
                </Deferred>
            </SectionCard>

            <Alert>
                <Info />
                <AlertDescription className="text-[0.9375rem]">
                    El plan, el entorno y el certificado digital los administra
                    el super administrador del sistema.
                </AlertDescription>
            </Alert>
        </>
    );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-[0.9375rem] break-words">{children}</dd>
        </div>
    );
}

/** Lee la prop diferida desde la página (ya cargada cuando Deferred muestra sus hijos). */
function UsageList() {
    const { usage } = usePage<{ usage?: unknown }>().props;

    if (usage === null || usage === undefined) {
        return (
            <p className="text-[0.9375rem] text-muted-foreground">
                Disponible cuando el taller esté registrado en la API de
                facturación.
            </p>
        );
    }

    if (typeof usage !== 'object') {
        return <p className="text-[0.9375rem]">{formatValue(usage)}</p>;
    }

    const entries = Object.entries(usage as Record<string, unknown>);

    if (entries.length === 0) {
        return (
            <p className="text-[0.9375rem] text-muted-foreground">
                No hay datos de consumo.
            </p>
        );
    }

    return <KeyValueRows entries={entries} />;
}

function KeyValueRows({ entries }: { entries: [string, unknown][] }) {
    return (
        <dl className="divide-y">
            {entries.map(([key, value]) => (
                <div
                    key={key}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4"
                >
                    <dt className="text-sm text-muted-foreground">
                        {humanize(key)}
                    </dt>
                    <dd className="min-w-0 text-[0.9375rem] break-words">
                        {value !== null &&
                        typeof value === 'object' &&
                        !Array.isArray(value) ? (
                            <KeyValueRows
                                entries={Object.entries(
                                    value as Record<string, unknown>,
                                )}
                            />
                        ) : (
                            <span className="tabular-nums">
                                {formatValue(value)}
                            </span>
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function humanize(key: string): string {
    const text = key.replace(/[_-]+/g, ' ').trim();

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (value === -1 || value === '-1') {
        return 'Ilimitado';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }

    if (typeof value === 'number') {
        return new Intl.NumberFormat('es-PE').format(value);
    }

    if (Array.isArray(value)) {
        return value.map(formatValue).join(', ');
    }

    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value);
}

BillingStatusPage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: billingRoute() },
        { title: 'Facturación electrónica', href: billingRoute() },
    ],
};
