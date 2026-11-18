<?php

namespace App\Services\Sales;

use App\Enums\IgvAffectation;
use App\Enums\WorkOrderStatus;
use App\Models\Company;
use App\Models\Customer;
use App\Models\ElectronicDocument;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\Service;
use App\Models\WorkOrder;
use App\Services\Audit\ActivityLogger;
use App\Services\Inventory\StockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Registro de ventas. Reglas:
 * - Una OT finalizada tiene como máximo una venta activa (bloqueo de la OT);
 *   las ventas anuladas quedan en su historial.
 * - Los ítems se copian una sola vez como instantánea; la venta es inmutable.
 * - El stock de repuestos se descuenta aquí (único punto) y se devuelve al anular.
 * - La suma de los pagos debe ser igual al total (venta al contado).
 */
class SaleService
{
    public function __construct(
        private readonly TaxCalculator $tax,
        private readonly StockService $stock,
        private readonly ActivityLogger $activity,
    ) {}

    /**
     * @param  list<array{method: string, amount: float|string, reference?: string|null}>  $payments
     */
    public function fromWorkOrder(WorkOrder $order, array $payments, ?string $notes = null): Sale
    {
        return DB::transaction(function () use ($order, $payments, $notes): Sale {
            /** @var WorkOrder $locked */
            $locked = WorkOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== WorkOrderStatus::Finished) {
                throw ValidationException::withMessages(['sale' => 'Solo se puede generar la venta de una orden finalizada.']);
            }

            // La OT está bloqueada (FOR UPDATE): dos cobros simultáneos no pueden
            // crear dos ventas activas.
            if (Sale::query()->withoutGlobalScopes()->where('work_order_id', $locked->id)->where('status', Sale::STATUS_REGISTERED)->exists()) {
                throw ValidationException::withMessages(['sale' => 'Esta orden ya tiene una venta registrada.']);
            }

            $lines = $locked->items()->with(['service', 'product'])->get()->map(fn ($item) => [
                'type' => $item->type,
                'service' => $item->service,
                'product' => $item->product,
                'description' => $item->description,
                'unit' => $item->unit,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'igv_affectation' => $item->igv_affectation,
            ])->all();

            if ($lines === []) {
                throw ValidationException::withMessages(['sale' => 'La orden no tiene ítems.']);
            }

            $sale = $this->persist($locked->company()->with('billingSettings')->firstOrFail(), $locked->customer_id, $lines, $payments, $notes, $locked);

            $this->activity->log('sale.created', "Se registró la venta {$sale->code()} de la {$locked->code()} por S/ {$sale->total}.", $sale);

            return $sale;
        });
    }

    /**
     * Venta directa (mostrador).
     *
     * @param  list<array{type: string, service_id?: int|null, product_id?: int|null, description?: string|null, quantity: float|string, unit_price?: float|string|null}>  $items
     * @param  list<array{method: string, amount: float|string, reference?: string|null}>  $payments
     */
    public function direct(Company $company, Customer $customer, array $items, array $payments, ?string $notes = null): Sale
    {
        return DB::transaction(function () use ($company, $customer, $items, $payments, $notes): Sale {
            $lines = array_map(function (array $data): array {
                if ($data['type'] === 'service') {
                    $service = Service::query()->findOrFail($data['service_id']);

                    return [
                        'type' => 'service', 'service' => $service, 'product' => null,
                        'description' => ($data['description'] ?? '') ?: $service->name,
                        'unit' => 'ZZ',
                        'quantity' => (float) $data['quantity'],
                        'unit_price' => (float) ($data['unit_price'] ?? $service->price),
                        'igv_affectation' => $service->igv_affectation,
                    ];
                }

                if ($data['type'] === 'product') {
                    $product = Product::query()->findOrFail($data['product_id']);

                    return [
                        'type' => 'product', 'service' => null, 'product' => $product,
                        'description' => ($data['description'] ?? '') ?: $product->name,
                        'unit' => $product->unit,
                        'quantity' => (float) $data['quantity'],
                        'unit_price' => (float) ($data['unit_price'] ?? $product->sale_price),
                        'igv_affectation' => $product->igv_affectation,
                    ];
                }

                return [
                    'type' => 'labor', 'service' => null, 'product' => null,
                    'description' => (string) $data['description'],
                    'unit' => 'ZZ',
                    'quantity' => (float) $data['quantity'],
                    'unit_price' => (float) $data['unit_price'],
                    'igv_affectation' => IgvAffectation::Taxed,
                ];
            }, $items);

            $sale = $this->persist($company->loadMissing('billingSettings'), $customer->id, $lines, $payments, $notes);

            $this->activity->log('sale.created', "Se registró la venta directa {$sale->code()} por S/ {$sale->total}.", $sale);

            return $sale;
        });
    }

    /**
     * Anula una venta sin comprobante aceptado y devuelve el stock.
     */
    public function void(Sale $sale, string $reason, bool $fromCreditNote = false): Sale
    {
        return DB::transaction(function () use ($sale, $reason, $fromCreditNote): Sale {
            /** @var Sale $locked */
            $locked = Sale::query()->withoutGlobalScopes()->whereKey($sale->id)->lockForUpdate()->firstOrFail();

            if ($locked->isVoided()) {
                throw ValidationException::withMessages(['void' => 'La venta ya está anulada.']);
            }

            // Con un comprobante electrónico vigente (o sin confirmar) la venta
            // solo se anula mediante nota de crédito.
            if (! $fromCreditNote) {
                $document = ElectronicDocument::query()->withoutGlobalScopes()
                    ->where('sale_id', $locked->id)
                    ->whereIn('document_type', ['01', '03'])
                    ->whereNotNull('issuance_key')
                    ->first();

                if ($document !== null) {
                    throw ValidationException::withMessages([
                        'void' => "La venta tiene el comprobante {$document->fullNumber()} ({$document->local_status->label()}). "
                            .($document->local_status->value === 'failed'
                                ? 'Descarte ese intento antes de anular la venta.'
                                : 'Anúlelo con una nota de crédito.'),
                    ]);
                }
            }

            foreach ($locked->items()->where('type', 'product')->whereNotNull('product_id')->get() as $item) {
                $product = Product::query()->withTrashed()->find($item->product_id);

                if ($product !== null) {
                    $this->stock->move($product, (float) $item->quantity, 'return', "Anulación de venta {$locked->code()}", $locked);
                }
            }

            $locked->forceFill([
                'status' => Sale::STATUS_VOIDED,
                'voided_at' => now(),
                'voided_by' => auth()->id(),
                'void_reason' => $reason,
            ])->save();

            $this->activity->log('sale.voided', "Se anuló la venta {$locked->code()}: {$reason}", $locked, ['reason' => $reason]);

            return $locked;
        });
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     * @param  list<array{method: string, amount: float|string, reference?: string|null}>  $payments
     */
    private function persist(Company $company, int $customerId, array $lines, array $payments, ?string $notes, ?WorkOrder $order = null): Sale
    {
        $rate = $this->tax->rateFor($company);
        $priced = [];

        foreach ($lines as $line) {
            $priced[] = [...$line, ...$this->tax->line($line['quantity'], $line['unit_price'], $line['igv_affectation'], $rate)];
        }

        $totals = $this->tax->sum($priced);
        $this->ensurePaymentsMatch($payments, $totals['total']);
        $this->ensureStock($priced);

        Company::query()->whereKey($company->id)->lockForUpdate()->first();
        $next = (int) Sale::query()->withoutGlobalScopes()->where('company_id', $company->id)->max('number') + 1;

        $sale = new Sale(['customer_id' => $customerId, 'notes' => $notes]);
        $sale->forceFill([
            'company_id' => $company->id,
            'number' => $next,
            'work_order_id' => $order?->id,
            'issued_at' => now(),
            'currency' => 'PEN',
            'status' => Sale::STATUS_REGISTERED,
            'created_by' => auth()->id(),
            ...$totals,
        ])->save();

        foreach ($priced as $index => $line) {
            /** @var Service|null $service */
            $service = $line['service'];
            /** @var Product|null $product */
            $product = $line['product'];

            $sale->items()->create([
                'type' => $line['type'],
                'service_id' => $service?->id,
                'product_id' => $product?->id,
                'code' => $product?->code ?? ($service ? 'SERV-'.$service->id : 'MO'),
                'description' => $line['description'],
                'unit' => $line['unit'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'igv_affectation' => $line['igv_affectation'],
                'sunat_product_code' => $service?->sunat_product_code ?? $product?->sunat_product_code,
                // La mano de obra se considera servicio sujeto a detracción.
                'subject_to_detraction' => $line['type'] === 'labor' ? true : (bool) ($service?->subject_to_detraction ?? false),
                'detraction_type_id' => $service?->detraction_type_id,
                'subtotal' => $line['subtotal'],
                'igv' => $line['igv'],
                'total' => $line['total'],
                'sort_order' => $index,
            ]);

            if ($product !== null) {
                $this->stock->move($product, -$line['quantity'], 'out', "Venta {$sale->code()}", $sale);
            }
        }

        foreach ($payments as $payment) {
            $sale->payments()->create([
                'method' => $payment['method'],
                'amount' => round((float) $payment['amount'], 2),
                'reference' => $payment['reference'] ?? null,
                'paid_at' => now(),
            ]);
        }

        return $sale;
    }

    /**
     * @param  list<array{method: string, amount: float|string}>  $payments
     */
    private function ensurePaymentsMatch(array $payments, float $total): void
    {
        $paid = round(array_sum(array_map(fn ($p) => (float) $p['amount'], $payments)), 2);

        if (abs($paid - $total) > 0.005) {
            throw ValidationException::withMessages([
                'payments' => sprintf('La suma de los pagos (S/ %s) debe ser igual al total de la venta (S/ %s).', number_format($paid, 2), number_format($total, 2)),
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $lines
     */
    private function ensureStock(array $lines): void
    {
        $needed = [];

        foreach ($lines as $line) {
            if ($line['product'] instanceof Product) {
                $needed[$line['product']->id] = ($needed[$line['product']->id] ?? 0) + $line['quantity'];
            }
        }

        foreach ($needed as $productId => $quantity) {
            $product = Product::query()->withTrashed()->lockForUpdate()->find($productId);

            if ($product !== null && (float) $product->stock + 0.0005 < $quantity) {
                throw ValidationException::withMessages([
                    'stock' => "Stock insuficiente de {$product->name} ({$product->code}): disponible ".rtrim(rtrim((string) $product->stock, '0'), '.')." {$product->unit}, se requieren ".rtrim(rtrim(number_format($quantity, 3, '.', ''), '0'), '.').'. Ajuste el inventario antes de registrar la venta.',
                ]);
            }
        }
    }
}
