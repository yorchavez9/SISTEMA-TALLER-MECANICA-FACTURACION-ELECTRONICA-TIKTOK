<?php

namespace App\Services\Audit;

use App\Models\ActivityLog;
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
     */
    public function log(
        string $action,
        string $description,
        ?Model $subject = null,
        array $properties = [],
        ?User $user = null,
    ): ActivityLog {
        $user ??= $this->request->user();

        return ActivityLog::create([
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
