<?php

namespace App\Models;

use App\Enums\IgvAffectation;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Servicio del taller. Precio con IGV; unidad SUNAT siempre ZZ.
 *
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property string|null $description
 * @property string $price
 * @property IgvAffectation $igv_affectation
 * @property string|null $sunat_product_code
 * @property bool $subject_to_detraction
 * @property int|null $detraction_type_id
 * @property bool $is_active
 */
class Service extends Model
{
    /** @use HasFactory<\Database\Factories\ServiceFactory> */
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'description', 'price', 'igv_affectation', 'sunat_product_code',
        'subject_to_detraction', 'detraction_type_id', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'igv_affectation' => IgvAffectation::class,
            'subject_to_detraction' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<DetractionType, $this>
     */
    public function detractionType(): BelongsTo
    {
        return $this->belongsTo(DetractionType::class);
    }
}
