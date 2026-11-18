<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Models\User;
use App\Support\Tenancy\CurrentCompany;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige y fija la empresa (taller) actual para las rutas del taller.
 *
 * - Usuario de un taller: siempre su propia empresa (no puede cambiarla).
 * - Super admin: la empresa que eligió con "Entrar al taller" (sesión).
 */
class EnsureCompanyContext
{
    public const SESSION_KEY = 'acting_company_id';

    public function __construct(private readonly CurrentCompany $current) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->company_id !== null) {
            $company = Company::query()->find($user->company_id);

            if ($company === null || ! $company->isActive()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->withErrors(['email' => 'El taller está suspendido. Comuníquese con el administrador del sistema.']);
            }

            $this->current->set($company);

            return $next($request);
        }

        if ($user->isSuperAdmin()) {
            $company = Company::query()->find($request->session()->get(self::SESSION_KEY));

            if ($company === null) {
                Inertia::flash('toast', ['type' => 'info', 'message' => 'Elija un taller y use "Entrar al taller" para ver su configuración.']);

                return redirect()->route('admin.companies.index');
            }

            $this->current->set($company);

            return $next($request);
        }

        abort(403);
    }
}
