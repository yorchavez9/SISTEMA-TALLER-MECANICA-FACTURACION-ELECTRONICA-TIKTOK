<?php

namespace App\Models;

use App\Enums\IgvAffectation;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/**
 * Producto o repuesto. El stock solo cambia mediante StockService.
 *
 * @property int $id
 * @property int $company_id
 * @property string $code
 * @property string $name
 * @property string|null $description
 * @property string $cost
 * @property string $sale_price
 * @property string $stock
 * @property string|null $min_stock
 * @property string $unit
 * @property IgvAffectation $igv_affectation
 * @property string|null $sunat_product_code
 * @property string|null $image
 * @property bool $is_active
 */
class Product extends Model
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use BelongsToCompany, HasFactory, SoftDeletes;

    /**
     * "stock" no es asignable: se modifica solo con movimientos de inventario.
     */
    protected $fillable = [
        'code', 'name', 'description', 'cost', 'sale_price', 'min_stock',
        'unit', 'igv_affectation', 'sunat_product_code', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'stock' => 'decimal:3',
            'min_stock' => 'decimal:3',
            'igv_affectation' => IgvAffectation::class,
            'is_active' => 'boolean',
        ];
    }

    public function imageUrl(): ?string
    {
        return $this->image ? Storage::disk('public')->url($this->image) : null;
    }

    public function thumbUrl(): ?string
    {
        return $this->image ? Storage::disk('public')->url(self::thumbPath($this->image)) : null;
    }

    public static function thumbPath(string $path): string
    {
        return preg_replace('/\.webp$/', '_thumb.webp', $path) ?? $path;
    }

    public function isLowStock(): bool
    {
        return $this->min_stock !== null && (float) $this->stock <= (float) $this->min_stock;
    }

    /**
     * @return HasMany<StockMovement, $this>
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
