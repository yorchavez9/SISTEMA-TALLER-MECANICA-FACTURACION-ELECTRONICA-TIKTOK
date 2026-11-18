<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApiOperationLog;
use App\Models\Company;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Bitácora de llamadas a la API de un taller (diagnóstico, solo super admin).
 */
class CompanyApiLogController extends Controller
{
    public function index(Request $request, Company $company): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'result' => ['nullable', 'in:ok,error'],
        ]);

        $logs = ApiOperationLog::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->with('user:id,first_name,last_name')
            ->when($filters['search'] ?? null, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->where('operation', 'like', "%{$s}%")
                ->orWhere('endpoint', 'like', "%{$s}%")
                ->orWhere('api_mensaje', 'like', "%{$s}%")))
            ->when(($filters['result'] ?? null) === 'error', fn (Builder $q) => $q->whereNotNull('error_type'))
            ->when(($filters['result'] ?? null) === 'ok', fn (Builder $q) => $q->whereNull('error_type'))
            ->latest('created_at')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (ApiOperationLog $log): array => [
                'id' => $log->id,
                'operation' => $log->operation,
                'http_method' => $log->http_method,
                'endpoint' => $log->endpoint,
                'http_status' => $log->http_status,
                'api_mensaje' => $log->api_mensaje,
                'error_type' => $log->error_type,
                'duration_ms' => $log->duration_ms,
                'request_summary' => $log->request_summary,
                'response_body' => $log->response_body,
                'user' => $log->user?->name,
                'created_at' => $log->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/companies/api-logs', [
            'company' => ['id' => $company->id, 'legal_name' => $company->legal_name, 'ruc' => $company->ruc],
            'logs' => $logs,
            'filters' => ['search' => $filters['search'] ?? '', 'result' => $filters['result'] ?? ''],
        ]);
    }
}
