<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tema inicial para el HTML del servidor: la preferencia guardada del usuario
 * autenticado tiene prioridad sobre la cookie (evita el parpadeo de tema).
 */
class HandleAppearance
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $appearance = $request->user()?->theme ?? $request->cookie('appearance') ?? 'system';

        if (! in_array($appearance, User::THEMES, true)) {
            $appearance = 'system';
        }

        View::share('appearance', $appearance);

        return $next($request);
    }
}
