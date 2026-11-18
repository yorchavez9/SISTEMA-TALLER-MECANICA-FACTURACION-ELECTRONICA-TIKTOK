<?php

namespace App\Models;

use App\Enums\DocumentType;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Serie de comprobantes. Las series no se eliminan: se desactivan.
 *
 * @property int $id
 * @property int $company_id
 * @property int $establishment_id
 * @property int|null $api_series_id
 * @property DocumentType $document_type
 * @property string $series
 * @property int $initial_number
 * @property int $last_number
 * @property bool $is_active
 * @property-read Establishment $establishment
 */
class DocumentSeries extends Model
{
    use BelongsToCompany;

    protected $fillable = ['establishment_id', 'document_type', 'series', 'initial_number', 'is_active'];

    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'initial_number' => 'integer',
            'last_number' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Establishment, $this>
     */
    public function establishment(): BelongsTo
    {
        return $this->belongsTo(Establishment::class);
    }
}
