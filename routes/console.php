<?php

use App\Models\ApiOperationLog;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
| Limpieza de la bitácora de llamadas a la API SUNAT (retención configurable).
| Solo borra registros antiguos; no interviene en el envío de comprobantes.
*/
Artisan::command('sunat:prune-api-logs', function () {
    $days = (int) config('sunat_api.log_retention_days');

    $deleted = ApiOperationLog::query()
        ->withoutGlobalScopes()
        ->where('created_at', '<', now()->subDays($days))
        ->delete();

    $this->info("Registros eliminados: {$deleted} (más antiguos que {$days} días).");
})->purpose('Elimina los registros de llamadas a la API SUNAT más antiguos que la retención configurada');

Schedule::command('sunat:prune-api-logs')->dailyAt('03:00')->withoutOverlapping();
