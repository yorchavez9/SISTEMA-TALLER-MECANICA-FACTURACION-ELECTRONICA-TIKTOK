<?php

namespace App\Models;

use App\Enums\WorkOrderStatus;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Orden de trabajo (OT).
 *
 * @property int $id
 * @property int $company_id
 * @property int $number
 * @property int $customer_id
 * @property int $vehicle_id
 * @property int|null $assigned_user_id
 * @property int|null $mileage_in
 * @property string $reported_problem
 * @property string|null $diagnosis
 * @property string|null $observations
 * @property WorkOrderStatus $status
 * @property Carbon $received_at
 * @property Carbon|null $promised_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $delivered_at
 * @property Carbon|null $cancelled_at
 * @property string $subtotal
 * @property string $igv
 * @property string $total
 * @property int|null $created_by
 * @property-read Customer $customer
 * @property-read Vehicle $vehicle
 */
class WorkOrder extends Model
{
    /** @use HasFactory<\Database\Factories\WorkOrderFactory> */
    use BelongsToCompany, HasFactory;

    protected $fillable = [
        'customer_id', 'vehicle_id', 'assigned_user_id', 'mileage_in', 'reported_problem',
        'diagnosis', 'observations', 'received_at', 'promised_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => WorkOrderStatus::class,
            'mileage_in' => 'integer',
            'received_at' => 'datetime',
            'promised_at' => 'datetime',
            'finished_at' => 'datetime',
            'delivered_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'igv' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function code(): string
    {
        return 'OT-'.str_pad((string) $this->number, 6, '0', STR_PAD_LEFT);
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Vehicle, $this>
     */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<WorkOrderItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(WorkOrderItem::class)->orderBy('sort_order')->orderBy('id');
    }
}
