import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { billing } from '@/routes/company-settings';
import { index as detractionIndex } from '@/routes/company-settings/detraction';
import { index as establishmentsIndex } from '@/routes/company-settings/establishments';
import { edit as profileEdit } from '@/routes/company-settings/profile';
import { index as seriesIndex } from '@/routes/company-settings/series';
import { index as usersIndex } from '@/routes/company-settings/users';
import type { NavItem } from '@/types';

/**
 * Layout de "Configuración del taller": navegación por secciones a la
 * izquierda en escritorio y como pestañas desplazables en móvil.
 */
export default function CompanySettingsLayout({ children }: PropsWithChildren) {
    const { company } = usePage().props;
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const can = useCan();

    const items: NavItem[] = [
        {
            title: 'Empresa',
            href: profileEdit(),
            visible: can('company_settings.manage'),
        },
        {
            title: 'Establecimientos',
            href: establishmentsIndex(),
            visible: can('company_settings.manage'),
        },
        {
            title: 'Series',
            href: seriesIndex(),
            visible: can('company_settings.manage'),
        },
        {
            title: 'Detracción',
            href: detractionIndex(),
            visible: can('company_settings.manage'),
        },
        {
            title: 'Usuarios',
            href: usersIndex(),
            visible: can('company_users.manage'),
        },
        {
            title: 'Facturación electrónica',
            href: billing(),
            visible: can('company_settings.manage'),
        },
    ].filter((item) => item.visible !== false);

    return (
        <PageContainer>
            <PageHeader
                title="Configuración del taller"
                description={
                    company ? `${company.name} · RUC ${company.ruc}` : undefined
                }
            />

            <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-10">
                <nav
                    aria-label="Secciones de configuración"
                    className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:w-56 lg:shrink-0 lg:overflow-visible lg:px-0"
                >
                    <ul className="flex gap-1 lg:flex-col">
                        {items.map((item) => {
                            const active = isCurrentOrParentUrl(item.href);

                            return (
                                <li key={toUrl(item.href)} className="shrink-0">
                                    <Link
                                        href={item.href}
                                        prefetch
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={cn(
                                            'flex h-10 items-center rounded-md px-3 text-[0.9375rem] whitespace-nowrap transition-colors',
                                            active
                                                ? 'bg-accent font-medium text-accent-foreground'
                                                : 'text-muted-foreground hover:text-foreground',
                                        )}
                                    >
                                        {item.title}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="min-w-0 flex-1 space-y-6">{children}</div>
            </div>
        </PageContainer>
    );
}
