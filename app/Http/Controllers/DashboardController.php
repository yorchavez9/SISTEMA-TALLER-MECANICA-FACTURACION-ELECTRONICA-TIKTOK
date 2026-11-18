<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dashboard. En la Fase 1 muestra la actividad reciente; los indicadores del
 * taller (ingresos, OT por estado, comprobantes) se agregan en la Fase 7.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $canViewActivity = $request->user()->can('activity_logs.view');

        return Inertia::render('dashboard', [
            'recentActivity' => $canViewActivity
                ? ActivityLog::query()
                    ->with('user:id,first_name,last_name')
                    ->latest('created_at')
                    ->latest('id')
                    ->limit(8)
                    ->get()
                    ->map(fn (ActivityLog $log): array => [
                        'id' => $log->id,
                        'description' => $log->description,
                        'user' => $log->user?->name,
                        'created_at' => $log->created_at->toIso8601String(),
                    ])
                : [],
        ]);
    }
}
