<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Taller (empresa cliente del sistema).
 *
 * @property int $id
 * @property string $uuid
 * @property string $ruc
 * @property string $legal_name
 * @property string|null $trade_name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $logo_path
 * @property string $status
 * @property string $api_plan
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read CompanyBillingSetting|null $billingSettings
 */
class Company extends Model
{
    /** @use HasFactory<\Database\Factories\CompanyFactory> */
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = ['ruc', 'legal_name', 'trade_name', 'email', 'phone', 'status', 'api_plan'];

    protected static function booted(): void
    {
        static::creating(function (Company $company): void {
            $company->uuid ??= (string) Str::uuid();
        });
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function displayName(): string
    {
        return $this->trade_name ?: $this->legal_name;
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }

    /**
     * @return HasOne<CompanyBillingSetting, $this>
     */
    public function billingSettings(): HasOne
    {
        return $this->hasOne(CompanyBillingSetting::class);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Establishment, $this>
     */
    public function establishments(): HasMany
    {
        return $this->hasMany(Establishment::class);
    }

    /**
     * @return HasMany<DocumentSeries, $this>
     */
    public function documentSeries(): HasMany
    {
        return $this->hasMany(DocumentSeries::class);
    }

    /**
     * @return HasMany<DetractionType, $this>
     */
    public function detractionTypes(): HasMany
    {
        return $this->hasMany(DetractionType::class);
    }
}
