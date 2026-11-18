<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $company_id
 * @property int|null $user_id
 * @property string $operation
 * @property string $http_method
 * @property string $endpoint
 * @property int|null $http_status
 * @property string|null $api_estado
 * @property string|null $api_mensaje
 * @property array<string, mixed>|null $request_summary
 * @property string|null $response_body
 * @property string|null $error_type
 * @property int $duration_ms
 * @property Carbon $created_at
 */
class ApiOperationLog extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    protected $fillable = [
        'company_id',
        'user_id',
        'operation',
        'http_method',
        'endpoint',
        'http_status',
        'api_estado',
        'api_mensaje',
        'request_summary',
        'response_body',
        'error_type',
        'duration_ms',
    ];

    protected function casts(): array
    {
        return [
            'request_summary' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
