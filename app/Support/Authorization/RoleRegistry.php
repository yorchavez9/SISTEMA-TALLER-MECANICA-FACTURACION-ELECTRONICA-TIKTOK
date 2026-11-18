<?php

namespace App\Support\Authorization;

use App\Enums\UserRole;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Catálogo central de roles y permisos.
 *
 * Los permisos siguen el formato "modulo.accion". El super admin no necesita
 * permisos explícitos: Gate::before le concede todo (ver AppServiceProvider).
 * Cada fase agrega aquí sus permisos y una migración que llama a sync().
 */
final class RoleRegistry
{
    public const GUARD = 'web';

    /**
     * @return array<string, string> permiso => descripción
     */
    public static function permissions(): array
    {
        return [
            'activity_logs.view' => 'Ver el registro de actividad',
            'company_settings.manage' => 'Configurar el taller (datos fiscales, establecimientos, series, detracción)',
            'company_users.manage' => 'Administrar los usuarios del taller',
            'customers.view' => 'Ver clientes',
            'customers.manage' => 'Registrar, editar y eliminar clientes',
            'vehicles.view' => 'Ver vehículos',
            'vehicles.manage' => 'Registrar, editar y eliminar vehículos',
            'services.view' => 'Ver servicios del taller',
            'services.manage' => 'Administrar servicios del taller',
            'products.view' => 'Ver productos y repuestos',
            'products.manage' => 'Administrar productos y repuestos',
            'stock.adjust' => 'Ajustar el stock de productos',
            'work_orders.view' => 'Ver órdenes de trabajo',
            'work_orders.manage' => 'Registrar órdenes y trabajar en ellas (diagnóstico, ítems, estados)',
            'work_orders.cancel' => 'Cancelar órdenes de trabajo',
        ];
    }

    /**
     * Permisos reservados al super admin (no se asignan a roles de taller):
     * certificado, plan, entorno, credenciales y aprovisionamiento. Se
     * verifican con el rol super_admin.
     *
     * @return array<string, list<string>> rol => permisos
     */
    public static function rolePermissions(): array
    {
        return [
            UserRole::SuperAdmin->value => [],
            UserRole::CompanyAdmin->value => [
                'activity_logs.view', 'company_settings.manage', 'company_users.manage',
                'customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage',
                'services.view', 'services.manage', 'products.view', 'products.manage', 'stock.adjust',
                'work_orders.view', 'work_orders.manage', 'work_orders.cancel',
            ],
            UserRole::Cashier->value => [
                'customers.view', 'customers.manage', 'vehicles.view', 'vehicles.manage',
                'services.view', 'products.view',
                'work_orders.view', 'work_orders.manage', 'work_orders.cancel',
            ],
            UserRole::Mechanic->value => [
                'customers.view', 'vehicles.view', 'services.view', 'products.view',
                'work_orders.view', 'work_orders.manage',
            ],
        ];
    }

    /**
     * Crea o actualiza roles y permisos de forma idempotente.
     */
    public static function sync(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (array_keys(self::permissions()) as $name) {
            Permission::findOrCreate($name, self::GUARD);
        }

        foreach (self::rolePermissions() as $roleName => $permissions) {
            $role = Role::findOrCreate($roleName, self::GUARD);
            $role->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
