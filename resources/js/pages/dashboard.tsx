import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, Building2, History } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { formatRelative } from '@/lib/format';
import { dashboard } from '@/routes';
import { index as activityLogsIndex } from '@/routes/activity-logs';

type RecentActivity = {
    id: number;
    description: string;
    user: string | null;
    created_at: string;
};

type Props = {
    recentActivity: RecentActivity[];
};

/**
 * Fase 1: bienvenida, próximos pasos y actividad reciente.
 * Los indicadores del taller (ingresos, OT por estado, comprobantes) se
 * incorporan en la Fase 7 con datos reales.
 */
export default function Dashboard({ recentActivity }: Props) {
    const { auth } = usePage().props;
    const can = useCan();

    return (
        <>
            <Head title="Dashboard" />

            <PageContainer>
                <PageHeader
                    title={`Hola, ${auth.user?.first_name ?? ''}`}
                    description="Resumen general del sistema."
                />

                <div className="grid gap-6 lg:grid-cols-5">
                    {auth.is_super_admin && (
                        <section className="rounded-xl border bg-card p-5 lg:col-span-2">
                            <div className="flex items-start gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                                    <Building2 className="size-5" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-base font-semibold">
                                        Siguiente paso: registrar talleres
                                    </h2>
                                    <p className="text-[0.9375rem] text-muted-foreground">
                                        El sistema quedó instalado. El alta de
                                        talleres, su configuración de
                                        facturación electrónica y sus usuarios
                                        se habilitan en la siguiente fase.
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {can('activity_logs.view') && (
                        <section
                            className={
                                auth.is_super_admin
                                    ? 'rounded-xl border bg-card lg:col-span-3'
                                    : 'rounded-xl border bg-card lg:col-span-5'
                            }
                        >
                            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
                                <h2 className="text-base font-semibold">
                                    Actividad reciente
                                </h2>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className="text-link"
                                >
                                    <Link href={activityLogsIndex()}>
                                        Ver todo
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            </div>

                            {recentActivity.length === 0 ? (
                                <EmptyState
                                    icon={History}
                                    title="Sin actividad todavía"
                                    description="Aquí aparecerán las operaciones recientes."
                                />
                            ) : (
                                <ul className="divide-y">
                                    {recentActivity.map((item) => (
                                        <li
                                            key={item.id}
                                            className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-[0.9375rem] break-words">
                                                    {item.description}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {item.user ?? 'Sistema'}
                                                </p>
                                            </div>
                                            <time
                                                dateTime={item.created_at}
                                                className="shrink-0 text-sm text-muted-foreground"
                                            >
                                                {formatRelative(
                                                    item.created_at,
                                                )}
                                            </time>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </div>
            </PageContainer>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
