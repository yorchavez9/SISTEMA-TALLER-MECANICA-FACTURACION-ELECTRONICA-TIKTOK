<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props compartidas. Solo se envía al navegador una lista explícita de
     * campos del usuario (nunca el modelo completo).
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'name' => $user->name,
                    'email' => $user->email,
                    'theme' => $user->theme,
                    'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
                    'created_at' => $user->created_at?->toIso8601String(),
                ] : null,
                'roles' => $user ? $user->getRoleNames()->values()->all() : [],
                'is_super_admin' => $user?->isSuperAdmin() ?? false,
                'permissions' => $user ? $user->getAllPermissions()->pluck('name')->values()->all() : [],
            ],
            'company' => fn () => $this->currentCompany($user),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * Taller en el que se opera (sin datos sensibles).
     *
     * @return array<string, mixed>|null
     */
    private function currentCompany(?User $user): ?array
    {
        $company = app(CurrentCompany::class)->get();

        if ($user === null || $company === null) {
            return null;
        }

        $settings = $company->billingSettings;

        return [
            'id' => $company->id,
            'ruc' => $company->ruc,
            'name' => $company->displayName(),
            'billing_status' => $settings?->status->value,
            'environment' => $settings?->environment,
            // true cuando el super admin entró a un taller ajeno.
            'acting_as_admin' => $user->company_id === null,
        ];
    }
}
