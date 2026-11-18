<?php

namespace App\Models;

use App\Enums\IgvAffectation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $sale_id
 * @property string $type
 * @property int|null $service_id
 * @property int|null $product_id
 * @property string|null $code
 * @property string $description
 * @property string $unit
 * @property string $quantity
 * @property string $unit_price
 * @property IgvAffectation $igv_affectation
 * @property string|null $sunat_product_code
 * @property bool $subject_to_detraction
 * @property int|null $detraction_type_id
 * @property string $subtotal
 * @property string $igv
 * @property string $total
 * @property int $sort_order
 */
class SaleItem extends Model
{
    protected $guarded = ['id', 'sale_id'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'igv_affectation' => IgvAffectation::class,
            'subject_to_detraction' => 'boolean',
            'subtotal' => 'decimal:2',
            'igv' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
