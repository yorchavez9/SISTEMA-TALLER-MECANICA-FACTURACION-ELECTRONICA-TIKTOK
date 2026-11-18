<?php

namespace App\Http\Middleware;

use App\Services\Setup\InstallationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bloquea el Setup Wizard una vez creado el primer super admin. Responde 404
 * para no revelar que la ruta existe.
 */
class RedirectIfInstalled
{
    public function __construct(private readonly InstallationService $installation) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        abort_if($this->installation->isInstalled(), 404);

        return $next($request);
    }
}
