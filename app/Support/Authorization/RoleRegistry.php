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
            UserRole::CompanyAdmin->value => ['activity_logs.view', 'company_settings.manage', 'company_users.manage'],
            UserRole::Cashier->value => [],
            UserRole::Mechanic->value => [],
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
