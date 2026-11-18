import { TriangleAlert } from 'lucide-react';
import {
    DetailList,
    environmentLabel,
    formatNumber,
} from '@/components/admin/company-shared';
import type {
    BillingDetail,
    CompanyAdmin,
    CompanyDetail,
    CompanyStats,
} from '@/components/admin/company-shared';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/format';

const TAX_REGIMES: Record<string, string> = {
    general: 'Régimen General',
    rer: 'Régimen Especial (RER)',
    mype: 'Régimen MYPE Tributario',
    rus: 'Nuevo RUS (solo boletas)',
};

function formatRate(value: string | number | null): string | null {
    if (value === null || value === '') {
        return null;
    }

    const n = Number(value);

    return Number.isFinite(n)
        ? `${n.toLocaleString('es-PE', { maximumFractionDigits: 2 })} %`
        : String(value);
}

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
    stats: CompanyStats;
    admins: CompanyAdmin[];
};

export function CompanyOverviewTab({ company, billing, stats, admins }: Props) {
    const override = formatRate(billing?.igv_rate_override ?? null);
    const igv = override ?? formatRate(billing?.igv_rate ?? null);
    const location = billing
        ? [billing.department, billing.province, billing.district]
              .filter(Boolean)
              .join(' / ')
        : '';

    return (
        <div className="grid gap-6">
            {billing?.last_error && (
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>Último error de la API</AlertTitle>
                    <AlertDescription className="text-[0.9375rem] break-words">
                        {billing.last_error}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Usuarios', value: stats.users },
                    { label: 'Establecimientos', value: stats.establishments },
                    { label: 'Series', value: stats.series },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border bg-card px-5 py-4"
                    >
                        <p className="text-sm text-muted-foreground">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums">
                            {formatNumber(stat.value)}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Datos fiscales">
                    <DetailList
                        items={[
                            {
                                label: 'Dirección fiscal',
                                value: billing?.fiscal_address || '—',
                            },
                            {
                                label: 'Ubigeo',
                                value: billing?.ubigeo ? (
                                    <span className="tabular-nums">
                                        {billing.ubigeo}
                                    </span>
                                ) : (
                                    '—'
                                ),
                            },
                            {
                                label: 'Departamento / provincia / distrito',
                                value: location || '—',
                            },
                            {
                                label: 'Régimen tributario',
                                value: billing?.tax_regime
                                    ? (TAX_REGIMES[billing.tax_regime] ??
                                      billing.tax_regime)
                                    : '—',
                            },
                            {
                                label: 'IGV vigente',
                                value: igv ? (
                                    <span className="tabular-nums">
                                        {igv}
                                        {override && (
                                            <span className="text-sm text-muted-foreground">
                                                {' '}
                                                (forzado)
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    '—'
                                ),
                            },
                            {
                                label: 'Entorno',
                                value: environmentLabel(
                                    billing?.environment ?? null,
                                ),
                            },
                        ]}
                    />
                </SectionCard>

                <SectionCard title="Contacto">
                    <DetailList
                        items={[
                            { label: 'Correo', value: company.email || '—' },
                            { label: 'Teléfono', value: company.phone || '—' },
                            { label: 'Plan', value: company.api_plan || '—' },
                            {
                                label: 'Registrado el',
                                value: formatDateTime(company.created_at),
                            },
                            {
                                label: 'Identificador',
                                value: (
                                    <span className="font-mono text-sm break-all">
                                        {company.uuid}
                                    </span>
                                ),
                            },
                        ]}
                    />
                </SectionCard>
            </div>

            <SectionCard
                title="Administradores"
                description="Usuarios con rol de administrador del taller."
            >
                {admins.length === 0 ? (
                    <p className="text-[0.9375rem] text-muted-foreground">
                        El taller no tiene administradores.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {admins.map((admin) => (
                            <li
                                key={admin.id}
                                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {admin.name}
                                    </p>
                                    <p className="truncate text-sm text-muted-foreground">
                                        {admin.email}
                                    </p>
                                </div>
                                <StatusBadge
                                    tone={
                                        admin.is_active ? 'success' : 'neutral'
                                    }
                                >
                                    {admin.is_active ? 'Activo' : 'Inactivo'}
                                </StatusBadge>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
