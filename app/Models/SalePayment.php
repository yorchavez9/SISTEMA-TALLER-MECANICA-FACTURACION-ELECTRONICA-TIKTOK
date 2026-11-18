<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $sale_id
 * @property PaymentMethod $method
 * @property string $amount
 * @property string|null $reference
 * @property Carbon $paid_at
 */
class SalePayment extends Model
{
    protected $fillable = ['method', 'amount', 'reference', 'paid_at'];

    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }
}
