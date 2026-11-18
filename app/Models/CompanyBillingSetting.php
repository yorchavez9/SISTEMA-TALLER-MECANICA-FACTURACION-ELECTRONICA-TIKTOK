<?php

namespace App\Models;

use App\Enums\BillingStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $company_id
 * @property string $fiscal_address
 * @property string $ubigeo
 * @property string $department
 * @property string $province
 * @property string $district
 * @property string $tax_regime
 * @property string|null $nrus_category
 * @property string|null $igv_rate
 * @property string|null $igv_rate_override
 * @property string|null $thanks_message
 * @property string $environment
 * @property Carbon|null $environment_changed_at
 * @property int|null $environment_changed_by
 * @property string|null $api_key
 * @property string|null $api_secret
 * @property string|null $sunat_client_id
 * @property BillingStatus $status
 * @property Carbon|null $provisioned_at
 * @property Carbon|null $last_synced_at
 * @property Carbon|null $last_validated_at
 * @property string|null $last_error
 * @property Carbon|null $certificate_uploaded_at
 * @property int|null $certificate_uploaded_by
 * @property Carbon|null $certificate_valid_to
 * @property bool $detraction_enabled
 * @property string|null $detraction_account
 * @property string $detraction_payment_method
 * @property string $detraction_threshold
 */
class CompanyBillingSetting extends Model
{
    public const ENVIRONMENTS = ['beta', 'production'];

    protected $fillable = [
        'fiscal_address',
        'ubigeo',
        'department',
        'province',
        'district',
        'tax_regime',
        'nrus_category',
        'thanks_message',
        'detraction_enabled',
        'detraction_account',
        'detraction_payment_method',
        'detraction_threshold',
    ];

    /**
     * Las credenciales de la API nunca se serializan.
     *
     * @var list<string>
     */
    protected $hidden = ['api_key', 'api_secret'];

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'api_secret' => 'encrypted',
            'status' => BillingStatus::class,
            'igv_rate' => 'decimal:2',
            'igv_rate_override' => 'decimal:2',
            'detraction_enabled' => 'boolean',
            'detraction_threshold' => 'decimal:2',
            'environment_changed_at' => 'datetime',
            'provisioned_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'last_validated_at' => 'datetime',
            'certificate_uploaded_at' => 'datetime',
            'certificate_valid_to' => 'date',
        ];
    }

    /**
     * El taller ya está registrado en la API y tiene credenciales.
     */
    public function hasCredentials(): bool
    {
        return filled($this->api_key) && filled($this->api_secret);
    }

    public function isReady(): bool
    {
        return $this->status === BillingStatus::Ready && $this->hasCredentials();
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
