<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Models\User;
use App\Support\Tenancy\CurrentCompany;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fija (sin exigir) la empresa actual en todas las peticiones autenticadas,
 * para que el layout, el dashboard y el registro de actividad queden
 * filtrados por taller. EnsureCompanyContext es la versión que la exige.
 */
class ResolveCompanyContext
{
    public function __construct(private readonly CurrentCompany $current) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        // Las páginas de administración de talleres operan sobre cualquier
        // taller explícito (la URL), nunca filtradas por el taller "entrado".
        if ($user !== null && ! $request->routeIs('admin.*')) {
            $companyId = $user->company_id ?? ($user->isSuperAdmin() ? $request->session()->get(EnsureCompanyContext::SESSION_KEY) : null);

            if ($companyId !== null) {
                $this->current->set(Company::query()->find($companyId));
            }
        }

        return $next($request);
    }
}
