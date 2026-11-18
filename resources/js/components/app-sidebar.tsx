import { Link } from '@inertiajs/react';
import { History, LayoutDashboard } from 'lucide-react';
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
import type { NavGroup } from '@/types';

/**
 * Menú principal. Cada fase agrega aquí sus módulos (Órdenes, Ventas,
 * Comprobantes, Clientes, Vehículos, etc.) a medida que existan.
 */
export function AppSidebar() {
    const can = useCan();

    const groups: NavGroup[] = [
        {
            title: 'Operación',
            items: [
                {
                    title: 'Dashboard',
                    href: dashboard(),
                    icon: LayoutDashboard,
                },
            ],
        },
        {
            title: 'Administración',
            items: [
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
