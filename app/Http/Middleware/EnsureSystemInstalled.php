<?php

namespace App\Http\Middleware;

use App\Services\Setup\InstallationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si todavía no existe el primer super admin, toda petición web se redirige al
 * Setup Wizard. La comprobación se hace siempre en el backend.
 */
class EnsureSystemInstalled
{
    public function __construct(private readonly InstallationService $installation) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->routeIs('setup.*') || $this->installation->isInstalled()) {
            return $next($request);
        }

        return redirect()->route('setup.show');
    }
}
