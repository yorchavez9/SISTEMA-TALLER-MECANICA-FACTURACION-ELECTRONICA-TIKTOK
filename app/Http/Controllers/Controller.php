<?php

namespace App\Http\Controllers;

use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

abstract class Controller
{
    /**
     * Vuelve al formulario con el error de la API visible (campo "api") y un
     * aviso. El detalle técnico queda en api_operation_logs.
     */
    protected function backWithApiError(SunatApiException $e, string $prefix = 'La API de facturación rechazó la operación'): RedirectResponse
    {
        $message = $prefix.'. '.$e->userMessage();

        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return back()->withErrors(['api' => $message]);
    }

    protected function toastSuccess(string $message): void
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);
    }
}
