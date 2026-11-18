import { Link, usePage } from '@inertiajs/react';
import {
    Building2,
    Car,
    ClipboardList,
    History,
    LayoutDashboard,
    Package,
    Receipt,
    Settings2,
    Users,
    Wrench,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { dashboard } from '@/routes';
import { index as activityLogs } from '@/routes/activity-logs';
import { index as companiesIndex } from '@/routes/admin/companies';
import { index as customersIndex } from '@/routes/customers';
import { index as productsIndex } from '@/routes/products';
import { index as salesIndex } from '@/routes/sales';
import { index as servicesIndex } from '@/routes/services';
import { index as vehiclesIndex } from '@/routes/vehicles';
import { index as workOrdersIndex } from '@/routes/work-orders';
import { edit as companyProfile } from '@/routes/company-settings/profile';
import { index as companyUsers } from '@/routes/company-settings/users';
import type { NavGroup } from '@/types';

/**
 * Menú principal. Cada fase agrega aquí sus módulos (Órdenes, Ventas,
 * Comprobantes, Clientes, Vehículos, etc.) a medida que existan.
 */
export function AppSidebar() {
    const { auth, company } = usePage().props;
    const can = useCan();

    const canConfigureCompany =
        company !== null &&
        (can('company_settings.manage') || can('company_users.manage'));

    const groups: NavGroup[] = [
        {
            title: 'Operación',
            items: [
                {
                    title: 'Dashboard',
                    href: dashboard(),
                    icon: LayoutDashboard,
                },
                {
                    title: 'Órdenes de trabajo',
                    href: workOrdersIndex(),
                    icon: ClipboardList,
                    visible: company !== null && can('work_orders.view'),
                },
                {
                    title: 'Ventas',
                    href: salesIndex(),
                    icon: Receipt,
                    visible: company !== null && can('sales.view'),
                },
            ],
        },
        {
            title: 'Maestros',
            items: [
                {
                    title: 'Clientes',
                    href: customersIndex(),
                    icon: Users,
                    visible: company !== null && can('customers.view'),
                },
                {
                    title: 'Vehículos',
                    href: vehiclesIndex(),
                    icon: Car,
                    visible: company !== null && can('vehicles.view'),
                },
                {
                    title: 'Servicios',
                    href: servicesIndex(),
                    icon: Wrench,
                    visible: company !== null && can('services.view'),
                },
                {
                    title: 'Productos y repuestos',
                    href: productsIndex(),
                    icon: Package,
                    visible: company !== null && can('products.view'),
                },
            ],
        },
        {
            title: 'Taller',
            items: [
                {
                    title: 'Configuración del taller',
                    href: can('company_settings.manage')
                        ? companyProfile()
                        : companyUsers(),
                    icon: Settings2,
                    visible: canConfigureCompany,
                },
            ],
        },
        {
            title: 'Administración',
            items: [
                {
                    title: 'Talleres',
                    href: companiesIndex(),
                    icon: Building2,
                    visible: auth.is_super_admin,
                },
                {
                    title: 'Registro de actividad',
                    href: activityLogs(),
                    icon: History,
                    visible: can('activity_logs.view'),
                },
            ],
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {groups.map((group) => (
                    <NavMain
                        key={group.title}
                        title={group.title}
                        items={group.items}
                    />
                ))}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
