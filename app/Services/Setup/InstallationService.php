<?php

namespace App\Services\Setup;

use App\Enums\UserRole;
use App\Models\SystemSetting;
use App\Models\User;
use App\Support\Authorization\RoleRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Estado de instalación y creación segura del primer super admin.
 */
class InstallationService
{
    private const CACHE_KEY = 'system.installed';

    /**
     * El sistema está instalado si system_settings.installed_at tiene valor o
     * ya existe algún super admin. Solo se cachea el valor "instalado", de modo
     * que una base de datos nueva siempre vuelve a evaluarse.
     */
    public function isInstalled(): bool
    {
        if (Cache::get(self::CACHE_KEY) === true) {
            return true;
        }

        $installed = SystemSetting::query()->whereKey(SystemSetting::SINGLETON_ID)->whereNotNull('installed_at')->exists()
            || $this->superAdminExists();

        if ($installed) {
            Cache::forever(self::CACHE_KEY, true);
        }

        return $installed;
    }

    /**
     * Crea el primer super admin de forma atómica.
     *
     * La fila única de system_settings se bloquea con SELECT ... FOR UPDATE:
     * si llegan dos peticiones a la vez, la segunda espera a que la primera
     * termine, encuentra installed_at con valor y falla con 404.
     *
     * @param  array{first_name: string, last_name: string, email: string, password: string}  $data
     */
    public function createSuperAdmin(array $data): User
    {
        $user = DB::transaction(function () use ($data): User {
            $settings = SystemSetting::query()
                ->whereKey(SystemSetting::SINGLETON_ID)
                ->lockForUpdate()
                ->first();

            if ($settings === null) {
                // Defensa ante una instalación incompleta: se crea la fila y se vuelve a bloquear.
                SystemSetting::query()->insertOrIgnore([
                    'id' => SystemSetting::SINGLETON_ID,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $settings = SystemSetting::query()->whereKey(SystemSetting::SINGLETON_ID)->lockForUpdate()->firstOrFail();
            }

            if ($settings->installed_at !== null || $this->superAdminExists()) {
                throw new NotFoundHttpException;
            }

            RoleRegistry::sync();

            $user = new User;
            $user->first_name = $data['first_name'];
            $user->last_name = $data['last_name'];
            $user->email = $data['email'];
            $user->password = $data['password']; // cast "hashed" => Hash::make
            $user->is_active = true;
            $user->email_verified_at = Carbon::now();
            $user->save();

            // El rol se asigna exclusivamente aquí, nunca desde datos del formulario.
            $user->assignRole(UserRole::SuperAdmin->value);

            $settings->forceFill([
                'installed_at' => Carbon::now(),
                'installed_by_user_id' => $user->id,
            ])->save();

            return $user;
        });

        Cache::forget(self::CACHE_KEY);

        return $user;
    }

    private function superAdminExists(): bool
    {
        return User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', UserRole::SuperAdmin->value))
            ->exists();
    }
}
