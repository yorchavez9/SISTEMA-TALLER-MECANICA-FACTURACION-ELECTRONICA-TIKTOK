<?php

namespace App\Services\Audit;

use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Registra operaciones importantes en activity_logs.
 *
 * Nunca se deben pasar en $properties contraseñas, certificados, Clave SOL ni
 * credenciales de la API.
 */
class ActivityLogger
{
    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>  $properties
     * @param  Company|null  $company  Taller afectado; si es null se usa la empresa actual.
     */
    public function log(
        string $action,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?User $user = null,
        ?Company $company = null,
    ): ActivityLog {
        $user ??= $this->request->user();

        return ActivityLog::create([
            'company_id' => $company?->id,
            'user_id' => $user?->getKey(),
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'properties' => $properties === [] ? null : $properties,
            'ip_address' => $this->request->ip(),
        ]);
    }
}
