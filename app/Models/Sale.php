<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Venta registrada (cobro). Sus ítems son una instantánea inmutable.
 *
 * @property int $id
 * @property int $company_id
 * @property int $number
 * @property int|null $work_order_id
 * @property int $customer_id
 * @property Carbon $issued_at
 * @property string $currency
 * @property string $subtotal
 * @property string $igv
 * @property string $total
 * @property string $status
 * @property string|null $notes
 * @property int|null $created_by
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property-read Customer $customer
 * @property-read WorkOrder|null $workOrder
 */
class Sale extends Model
{
    use BelongsToCompany;

    public const STATUS_REGISTERED = 'registered';

    public const STATUS_VOIDED = 'voided';

    protected $fillable = ['customer_id', 'notes'];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'voided_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'igv' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function code(): string
    {
        return 'V-'.str_pad((string) $this->number, 6, '0', STR_PAD_LEFT);
    }

    public function isVoided(): bool
    {
        return $this->status === self::STATUS_VOIDED;
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /**
     * @return BelongsTo<WorkOrder, $this>
     */
    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    /**
     * @return HasMany<SaleItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Comprobantes (factura/boleta) emitidos para la venta, incluidos los fallidos.
     *
     * @return HasMany<ElectronicDocument, $this>
     */
    public function electronicDocuments(): HasMany
    {
        return $this->hasMany(ElectronicDocument::class)->whereIn('document_type', ['01', '03']);
    }

    /**
     * @return HasMany<SalePayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }
}
