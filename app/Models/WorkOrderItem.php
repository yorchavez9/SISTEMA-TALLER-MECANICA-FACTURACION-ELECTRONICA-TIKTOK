<?php

namespace App\Models;

use App\Enums\IgvAffectation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Línea de una OT: servicio, repuesto (producto) o mano de obra libre.
 *
 * @property int $id
 * @property int $work_order_id
 * @property string $type
 * @property int|null $service_id
 * @property int|null $product_id
 * @property string $description
 * @property string $unit
 * @property string $quantity
 * @property string $unit_price
 * @property IgvAffectation $igv_affectation
 * @property string $subtotal
 * @property string $igv
 * @property string $total
 * @property int $sort_order
 */
class WorkOrderItem extends Model
{
    public const TYPES = [
        'service' => 'Servicio',
        'product' => 'Repuesto',
        'labor' => 'Mano de obra',
    ];

    protected $fillable = [
        'type', 'service_id', 'product_id', 'description', 'unit', 'quantity',
        'unit_price', 'igv_affectation', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'igv_affectation' => IgvAffectation::class,
            'subtotal' => 'decimal:2',
            'igv' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<WorkOrder, $this>
     */
    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    /**
     * @return BelongsTo<Service, $this>
     */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
