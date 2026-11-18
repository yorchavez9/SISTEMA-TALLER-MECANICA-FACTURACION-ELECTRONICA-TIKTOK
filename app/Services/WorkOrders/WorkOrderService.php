<?php

namespace App\Services\WorkOrders;

use App\Enums\IgvAffectation;
use App\Enums\WorkOrderStatus;
use App\Models\Company;
use App\Models\Product;
use App\Models\Service;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\Audit\ActivityLogger;
use App\Services\Sales\TaxCalculator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reglas de negocio de las órdenes de trabajo. Los totales siempre se
 * recalculan aquí (nunca se confía en los del navegador).
 */
class WorkOrderService
{
    public function __construct(
        private readonly TaxCalculator $tax,
        private readonly ActivityLogger $activity,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(Company $company, array $data): WorkOrder
    {
        return DB::transaction(function () use ($company, $data): WorkOrder {
            // Bloquea la fila del taller para asignar el correlativo sin colisiones.
            Company::query()->whereKey($company->id)->lockForUpdate()->first();

            $next = (int) WorkOrder::query()->withoutGlobalScopes()->where('company_id', $company->id)->max('number') + 1;

            $order = new WorkOrder([
                ...$data,
                'received_at' => $data['received_at'] ?? now(),
            ]);
            $order->company_id = $company->id;
            $order->number = $next;
            $order->status = WorkOrderStatus::Pending;
            $order->created_by = auth()->id();
            $order->save();

            $this->updateVehicleMileage($order);

            $this->activity->log('work_order.created', "Se registró la {$order->code()} ({$order->vehicle->formattedPlate()}).", $order, [
                'to' => WorkOrderStatus::Pending->value,
            ]);

            return $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(WorkOrder $order, array $data): WorkOrder
    {
        $this->ensureEditable($order);

        return DB::transaction(function () use ($order, $data): WorkOrder {
            $order->fill($data)->save();
            $this->updateVehicleMileage($order);

            $this->activity->log('work_order.updated', "Se actualizaron los datos de la {$order->code()}.", $order);

            return $order;
        });
    }

    /**
     * @param  array<string, mixed>  $data  type, service_id|product_id, description, quantity, unit_price
     */
    public function addItem(WorkOrder $order, array $data): WorkOrderItem
    {
        $this->ensureEditable($order);

        return DB::transaction(function () use ($order, $data): WorkOrderItem {
            $item = new WorkOrderItem($this->itemAttributes($data));
            $item->sort_order = (int) $order->items()->max('sort_order') + 1;
            $this->priceItem($item, $order);
            $order->items()->save($item);

            $this->recalculate($order);

            return $item;
        });
    }

    /**
     * @param  array<string, mixed>  $data  description, quantity, unit_price
     */
    public function updateItem(WorkOrder $order, WorkOrderItem $item, array $data): WorkOrderItem
    {
        $this->ensureEditable($order);
        $this->ensureItemBelongs($order, $item);

        return DB::transaction(function () use ($order, $item, $data): WorkOrderItem {
            $item->fill([
                'description' => $data['description'] ?? $item->description,
                'quantity' => $data['quantity'],
                'unit_price' => $data['unit_price'],
            ]);
            $this->priceItem($item, $order);
            $item->save();

            $this->recalculate($order);

            return $item;
        });
    }

    public function removeItem(WorkOrder $order, WorkOrderItem $item): void
    {
        $this->ensureEditable($order);
        $this->ensureItemBelongs($order, $item);

        DB::transaction(function () use ($order, $item): void {
            $item->delete();
            $this->recalculate($order);
        });
    }

    /**
     * Cambia el estado validando la transición.
     */
    public function changeStatus(WorkOrder $order, WorkOrderStatus $target, ?string $note = null): WorkOrder
    {
        $from = $order->status;

        if (! $from->canTransitionTo($target)) {
            throw ValidationException::withMessages([
                'status' => "No se puede pasar de \"{$from->label()}\" a \"{$target->label()}\".",
            ]);
        }

        if ($target === WorkOrderStatus::Finished && ! $order->items()->exists()) {
            throw ValidationException::withMessages([
                'status' => 'Agregue al menos un servicio, repuesto o mano de obra antes de finalizar.',
            ]);
        }

        return DB::transaction(function () use ($order, $from, $target, $note): WorkOrder {
            $order->status = $target;

            match ($target) {
                WorkOrderStatus::Finished => $order->finished_at = now(),
                WorkOrderStatus::Delivered => $order->delivered_at = now(),
                WorkOrderStatus::Cancelled => $order->cancelled_at = now(),
                WorkOrderStatus::InProgress => $order->finished_at = $from === WorkOrderStatus::Finished ? null : $order->finished_at,
                default => null,
            };

            $order->save();

            $this->activity->log(
                'work_order.status_changed',
                "{$order->code()}: {$from->label()} → {$target->label()}.",
                $order,
                array_filter(['from' => $from->value, 'to' => $target->value, 'note' => $note]),
            );

            return $order;
        });
    }

    /**
     * Recalcula totales de la OT a partir de sus ítems.
     */
    public function recalculate(WorkOrder $order): void
    {
        $totals = $this->tax->sum(
            $order->items()->get(['subtotal', 'igv', 'total'])->map(fn (WorkOrderItem $i) => [
                'subtotal' => $i->subtotal, 'igv' => $i->igv, 'total' => $i->total,
            ]),
        );

        $order->forceFill($totals)->save();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function itemAttributes(array $data): array
    {
        $type = $data['type'];

        if ($type === 'service') {
            /** @var Service $service */
            $service = Service::query()->findOrFail($data['service_id']);

            return [
                'type' => 'service',
                'service_id' => $service->id,
                'description' => ($data['description'] ?? '') ?: $service->name,
                'unit' => 'ZZ',
                'quantity' => $data['quantity'],
                'unit_price' => $data['unit_price'] ?? $service->price,
                'igv_affectation' => $service->igv_affectation,
            ];
        }

        if ($type === 'product') {
            /** @var Product $product */
            $product = Product::query()->findOrFail($data['product_id']);

            return [
                'type' => 'product',
                'product_id' => $product->id,
                'description' => ($data['description'] ?? '') ?: $product->name,
                'unit' => $product->unit,
                'quantity' => $data['quantity'],
                'unit_price' => $data['unit_price'] ?? $product->sale_price,
                'igv_affectation' => $product->igv_affectation,
            ];
        }

        return [
            'type' => 'labor',
            'description' => $data['description'],
            'unit' => 'ZZ',
            'quantity' => $data['quantity'],
            'unit_price' => $data['unit_price'],
            'igv_affectation' => IgvAffectation::Taxed,
        ];
    }

    private function priceItem(WorkOrderItem $item, WorkOrder $order): void
    {
        $rate = $this->tax->rateFor($order->company()->with('billingSettings')->first());
        $line = $this->tax->line((float) $item->quantity, (float) $item->unit_price, $item->igv_affectation, $rate);

        $item->forceFill($line);
    }

    private function updateVehicleMileage(WorkOrder $order): void
    {
        if ($order->mileage_in === null) {
            return;
        }

        Vehicle::query()
            ->whereKey($order->vehicle_id)
            ->where('current_mileage', '<', $order->mileage_in)
            ->update(['current_mileage' => $order->mileage_in]);
    }

    private function ensureEditable(WorkOrder $order): void
    {
        if (! $order->status->isEditable()) {
            throw ValidationException::withMessages([
                'status' => "La orden está \"{$order->status->label()}\" y ya no se puede modificar.",
            ]);
        }
    }

    private function ensureItemBelongs(WorkOrder $order, WorkOrderItem $item): void
    {
        abort_unless($item->work_order_id === $order->id, 404);
    }
}
