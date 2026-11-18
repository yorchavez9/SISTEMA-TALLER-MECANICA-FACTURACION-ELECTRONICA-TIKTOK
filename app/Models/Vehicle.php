<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $company_id
 * @property int $customer_id
 * @property string $plate
 * @property string $brand
 * @property string $model
 * @property int|null $year
 * @property string|null $color
 * @property string|null $vin
 * @property string|null $engine_number
 * @property int $current_mileage
 * @property string|null $features
 * @property string|null $notes
 * @property-read Customer $customer
 */
class Vehicle extends Model
{
    /** @use HasFactory<\Database\Factories\VehicleFactory> */
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_id', 'plate', 'brand', 'model', 'year', 'color', 'vin',
        'engine_number', 'current_mileage', 'features', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'current_mileage' => 'integer',
        ];
    }

    /**
     * Normaliza una placa: mayúsculas, sin espacios ni guiones.
     */
    public static function normalizePlate(?string $plate): string
    {
        return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $plate));
    }

    /**
     * Placa para mostrar: ABC123 → ABC-123.
     */
    public function formattedPlate(): string
    {
        return strlen($this->plate) === 6 ? substr($this->plate, 0, 3).'-'.substr($this->plate, 3) : $this->plate;
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
