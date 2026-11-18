<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $company_id
 * @property int $product_id
 * @property string $type
 * @property string $quantity
 * @property string $balance_after
 * @property string $reason
 * @property int|null $user_id
 * @property Carbon $created_at
 */
class StockMovement extends Model
{
    use BelongsToCompany;

    public const UPDATED_AT = null;

    public const TYPES = [
        'in' => 'Entrada',
        'out' => 'Salida',
        'adjust' => 'Ajuste',
        'return' => 'Devolución',
    ];

    protected $fillable = ['product_id', 'type', 'quantity', 'balance_after', 'reason', 'user_id'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'balance_after' => 'decimal:3',
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

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function source(): MorphTo
    {
        return $this->morphTo();
    }
}
