import { Head, Link, router, usePage } from '@inertiajs/react';
import { FileClock, LogIn, Power, PowerOff, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import {
    CompanyCertificateTab,
    CompanyRegistrationTab,
} from '@/components/admin/company-api-tab';
import { CompanyCredentialsTab } from '@/components/admin/company-credentials-tab';
import {
    CompanyAdvancedTab,
    CompanyEnvironmentTab,
} from '@/components/admin/company-environment-tab';
import { CompanyOverviewTab } from '@/components/admin/company-overview-tab';
import { CompanyPlanTab } from '@/components/admin/company-plan-tab';
import {
    BillingStatusBadge,
    EnvironmentBadge,
} from '@/components/admin/company-shared';
import type {
    BillingDetail,
    CompanyAdmin,
    CompanyDetail,
    CompanyStats,
    SubscriptionOverview,
} from '@/components/admin/company-shared';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    apiLogs,
    enter,
    index as companiesIndex,
    show,
    update,
} from '@/routes/admin/companies';
import type { ApiPlan, Option } from '@/types';

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
    stats: CompanyStats;
    admins: CompanyAdmin[];
    plans: ApiPlan[];
    subscription?: SubscriptionOverview;
    billingStatuses: Option[];
};

const TABS = [
    { value: 'overview', label: 'Resumen' },
    { value: 'registration', label: 'Registro en la API' },
    { value: 'certificate', label: 'Certificado' },
    { value: 'plan', label: 'Plan y suscripción' },
    { value: 'environment', label: 'Entorno' },
    { value: 'advanced', label: 'Avanzado' },
    { value: 'credentials', label: 'Credenciales API' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/** La pestaña activa se recuerda por taller para no perderla tras cada acción. */
function storageKey(companyId: number): string {
    return `admin.company.${companyId}.tab`;
}

function readTab(companyId: number): TabValue {
    try {
        const stored = window.sessionStorage.getItem(storageKey(companyId));

        if (stored && TABS.some((t) => t.value === stored)) {
            return stored as TabValue;
        }
    } catch {
        // Almacenamiento no disponible.
    }

    return 'overview';
}

export default function CompaniesShow({
    company,
    billing,
    stats,
    admins,
    plans,
    subscription,
}: Props) {
    const { errors } = usePage().props as {
        errors: Record<string, string | undefined>;
    };
    const [tab, setTab] = useState<TabValue>(() =>
        typeof window === 'undefined' ? 'overview' : readTab(company.id),
    );
    const [statusOpen, setStatusOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [entering, setEntering] = useState(false);
    const suspended = company.status === 'suspended';

    const changeTab = (value: string) => {
        setTab(value as TabValue);

        try {
            window.sessionStorage.setItem(storageKey(company.id), value);
        } catch {
            // Almacenamiento no disponible.
        }
    };

    const confirmStatus = () => {
        setUpdatingStatus(true);
        router.patch(
            update.url(company.id),
            { status: suspended ? 'active' : 'suspended' },
            {
                preserveScroll: true,
                onFinish: () => {
                    setUpdatingStatus(false);
                    setStatusOpen(false);
                },
            },
        );
    };

    const enterCompany = () => {
        setEntering(true);
        router.post(
            enter.url(company.id),
            {},
            { onFinish: () => setEntering(false) },
        );
    };

    return (
        <>
            <Head title={company.legal_name} />

            <PageContainer>
                <PageHeader
                    title={company.legal_name}
                    description={
                        <span className="flex flex-col gap-2">
                            <span>
                                RUC{' '}
                                <span className="tabular-nums">
                                    {company.ruc}
                                </span>
                                {company.trade_name && (
                                    <> · {company.trade_name}</>
                                )}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                                <BillingStatusBadge
                                    status={billing?.status ?? null}
                                    label={billing?.status_label}
                                />
                                <EnvironmentBadge
                                    environment={billing?.environment ?? null}
                                />
                                {suspended && (
                                    <StatusBadge tone="danger">
                                        Suspendido
                                    </StatusBadge>
                                )}
                            </span>
                        </span>
                    }
                    actions={
                        <>
                            <Button onClick={enterCompany} disabled={entering}>
                                <LogIn />
                                Entrar al taller
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={apiLogs(company.id)}>
                                    <FileClock />
                                    Registro de llamadas
                                </Link>
                            </Button>
                            <Button
                                variant={suspended ? 'outline' : 'destructive'}
                                onClick={() => setStatusOpen(true)}
                            >
                                {suspended ? <Power /> : <PowerOff />}
                                {suspended ? 'Reactivar' : 'Suspender'}
                            </Button>
                        </>
                    }
                />

                {errors.api && (
                    <Alert variant="destructive">
                        <TriangleAlert />
                        <AlertDescription className="text-[0.9375rem] break-words">
                            {errors.api}
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs
                    value={tab}
                    onValueChange={changeTab}
                    className="min-w-0 gap-4"
                >
                    <div className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                        <TabsList className="h-10 w-max">
                            {TABS.map((t) => (
                                <TabsTrigger
                                    key={t.value}
                                    value={t.value}
                                    className="flex-none px-3 text-sm"
                                >
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <TabsContent value="overview">
                        <CompanyOverviewTab
                            company={company}
                            billing={billing}
                            stats={stats}
                            admins={admins}
                        />
                    </TabsContent>
                    <TabsContent value="registration">
                        <CompanyRegistrationTab
                            company={company}
                            billing={billing}
                        />
                    </TabsContent>
                    <TabsContent value="certificate">
                        <CompanyCertificateTab
                            company={company}
                            billing={billing}
                        />
                    </TabsContent>
                    <TabsContent value="plan">
                        <CompanyPlanTab
                            company={company}
                            billing={billing}
                            plans={plans}
                            subscription={subscription}
                        />
                    </TabsContent>
                    <TabsContent value="environment">
                        <CompanyEnvironmentTab
                            company={company}
                            billing={billing}
                        />
                    </TabsContent>
                    <TabsContent value="advanced">
                        <CompanyAdvancedTab
                            company={company}
                            billing={billing}
                        />
                    </TabsContent>
                    <TabsContent value="credentials">
                        <CompanyCredentialsTab
                            company={company}
                            billing={billing}
                        />
                    </TabsContent>
                </Tabs>
            </PageContainer>

            <ConfirmDialog
                open={statusOpen}
                onOpenChange={setStatusOpen}
                title={
                    suspended
                        ? `¿Reactivar ${company.legal_name}?`
                        : `¿Suspender ${company.legal_name}?`
                }
                description={
                    suspended
                        ? 'Los usuarios del taller podrán volver a ingresar al sistema.'
                        : 'Los usuarios del taller no podrán ingresar al sistema hasta que lo reactive. Los datos se conservan.'
                }
                confirmLabel={suspended ? 'Reactivar' : 'Suspender'}
                variant={suspended ? 'default' : 'destructive'}
                processing={updatingStatus}
                onConfirm={confirmStatus}
            />
        </>
    );
}

CompaniesShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Talleres', href: companiesIndex() },
        { title: props.company.legal_name, href: show(props.company.id) },
    ],
});
