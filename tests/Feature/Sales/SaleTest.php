<?php

namespace Tests\Feature\Sales;

use App\Enums\UserRole;
use App\Enums\WorkOrderStatus;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Service;
use App\Models\StockMovement;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Services\Inventory\StockService;
use Tests\Feature\Catalog\CatalogTestCase;

class SaleTest extends CatalogTestCase
{
    private Customer $customer;

    private Product $product;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = $this->makeFor($this->company, Customer::factory());
        $this->product = $this->makeFor($this->company, Product::factory(), ['sale_price' => 59]);
        $this->service = $this->makeFor($this->company, Service::factory(), ['price' => 118, 'subject_to_detraction' => true]);

        $this->actingAs($this->admin);
        app(\App\Support\Tenancy\CurrentCompany::class)->set($this->company);
        app(StockService::class)->move($this->product, 10, 'in', 'Stock inicial');
        app(\App\Support\Tenancy\CurrentCompany::class)->set(null);
    }

    /**
     * OT finalizada con 1 servicio (118) + 2 repuestos (2×59) = 236.
     */
    private function finishedWorkOrder(): WorkOrder
    {
        $vehicle = $this->makeFor($this->company, Vehicle::factory(), ['customer_id' => $this->customer->id]);

        $this->post(route('work-orders.store'), [
            'customer_id' => $this->customer->id, 'vehicle_id' => $vehicle->id, 'reported_problem' => 'Mantenimiento',
        ])->assertSessionHasNoErrors();
        $order = WorkOrder::query()->withoutGlobalScopes()->latest('id')->firstOrFail();

        $this->post(route('work-orders.items.store', $order), ['type' => 'service', 'service_id' => $this->service->id, 'quantity' => 1])->assertRedirect();
        $this->post(route('work-orders.items.store', $order), ['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 2])->assertRedirect();
        $this->post(route('work-orders.status', $order), ['status' => 'in_progress'])->assertSessionHasNoErrors();
        $this->post(route('work-orders.status', $order), ['status' => 'finished'])->assertSessionHasNoErrors();

        return $order->fresh();
    }

    public function test_sale_from_finished_work_order_copies_items_and_deducts_stock_once(): void
    {
        $order = $this->finishedWorkOrder();

        $this->post(route('work-orders.sale.store', $order), [
            'payments' => [
                ['method' => 'cash', 'amount' => '200.00'],
                ['method' => 'yape', 'amount' => '36.00', 'reference' => 'OP-123'],
            ],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $sale = Sale::query()->withoutGlobalScopes()->sole();
        $this->assertSame('V-000001', $sale->code());
        $this->assertSame($order->id, $sale->work_order_id);
        $this->assertSame('236.00', $sale->total);
        $this->assertSame('200.00', $sale->subtotal);
        $this->assertSame('36.00', $sale->igv);
        $this->assertCount(2, $sale->items);
        $this->assertCount(2, $sale->payments);
        $this->assertTrue($sale->items->firstWhere('type', 'service')->subject_to_detraction);
        $this->assertSame($this->product->code, $sale->items->firstWhere('type', 'product')->code);

        $this->assertEquals(8, (float) $this->product->fresh()->stock);

        // Segunda venta de la misma OT: rechazada; el stock no vuelve a bajar.
        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'cash', 'amount' => '236']]])
            ->assertSessionHasErrors('sale');
        $this->assertSame(1, Sale::query()->withoutGlobalScopes()->count());
        $this->assertEquals(8, (float) $this->product->fresh()->stock);
    }

    public function test_payments_must_match_total(): void
    {
        $order = $this->finishedWorkOrder();

        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'cash', 'amount' => '100']]])
            ->assertSessionHasErrors('payments');

        $this->assertSame(0, Sale::query()->withoutGlobalScopes()->count());
        $this->assertEquals(10, (float) $this->product->fresh()->stock);
    }

    public function test_sale_requires_finished_work_order(): void
    {
        $vehicle = $this->makeFor($this->company, Vehicle::factory(), ['customer_id' => $this->customer->id]);
        $this->post(route('work-orders.store'), ['customer_id' => $this->customer->id, 'vehicle_id' => $vehicle->id, 'reported_problem' => 'X problema']);
        $order = WorkOrder::query()->withoutGlobalScopes()->latest('id')->firstOrFail();

        $this->post(route('work-orders.sale.store', $order), ['payments' => []])->assertSessionHasErrors('sale');
    }

    public function test_insufficient_stock_blocks_the_sale(): void
    {
        $this->post(route('sales.store'), [
            'customer_id' => $this->customer->id,
            'items' => [['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 11]],
            'payments' => [['method' => 'cash', 'amount' => '649']],
        ])->assertSessionHasErrors('stock');

        $this->assertSame(0, Sale::query()->withoutGlobalScopes()->count());
    }

    public function test_direct_sale_with_labor_and_card_payment(): void
    {
        $this->post(route('sales.store'), [
            'customer_id' => $this->customer->id,
            'items' => [
                ['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 1],
                ['type' => 'labor', 'description' => 'Instalación', 'quantity' => 1, 'unit_price' => 41],
            ],
            'payments' => [['method' => 'card', 'amount' => '100.00', 'reference' => 'VOUCHER 556']],
            'notes' => 'Venta de mostrador',
        ])->assertSessionHasNoErrors()->assertRedirect();

        $sale = Sale::query()->withoutGlobalScopes()->sole();
        $this->assertNull($sale->work_order_id);
        $this->assertSame('100.00', $sale->total);
        $this->assertEquals(9, (float) $this->product->fresh()->stock);
    }

    public function test_void_returns_stock_and_unlocks_reopening(): void
    {
        $order = $this->finishedWorkOrder();
        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'cash', 'amount' => '236']]]);
        $sale = Sale::query()->withoutGlobalScopes()->sole();

        // Con venta activa no se puede reabrir la OT.
        $this->post(route('work-orders.status', $order), ['status' => 'in_progress'])->assertSessionHasErrors('status');

        $this->post(route('sales.void', $sale), ['reason' => 'Cliente desistió'])->assertSessionHasNoErrors();

        $sale->refresh();
        $this->assertSame(Sale::STATUS_VOIDED, $sale->status);
        $this->assertEquals(10, (float) $this->product->fresh()->stock);
        $this->assertTrue(StockMovement::query()->withoutGlobalScopes()->where('type', 'return')->exists());

        // Ahora sí se puede reabrir.
        $this->post(route('work-orders.status', $order), ['status' => 'in_progress'])->assertSessionHasNoErrors();

        $this->post(route('sales.void', $sale), ['reason' => 'Otra vez'])->assertSessionHasErrors('void');
    }

    public function test_a_work_order_can_be_sold_again_after_voiding_its_sale(): void
    {
        $order = $this->finishedWorkOrder();
        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'cash', 'amount' => '236']]])->assertRedirect();
        $first = Sale::query()->withoutGlobalScopes()->sole();
        $this->post(route('sales.void', $first), ['reason' => 'Error en el método de pago'])->assertSessionHasNoErrors();

        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'card', 'amount' => '236']]])
            ->assertSessionHasNoErrors()->assertRedirect();

        $this->assertSame(2, Sale::query()->withoutGlobalScopes()->where('work_order_id', $order->id)->count());
        $this->assertSame(1, Sale::query()->withoutGlobalScopes()->where('work_order_id', $order->id)->where('status', 'registered')->count());
        $this->assertEquals(8, (float) $this->product->fresh()->stock);
    }

    public function test_delivery_requires_a_registered_sale(): void
    {
        $order = $this->finishedWorkOrder();

        $this->post(route('work-orders.status', $order), ['status' => 'delivered'])->assertSessionHasErrors('status');

        $this->post(route('work-orders.sale.store', $order), ['payments' => [['method' => 'cash', 'amount' => '236']]]);
        $this->post(route('work-orders.status', $order), ['status' => 'delivered'])->assertSessionHasNoErrors();

        $this->assertSame(WorkOrderStatus::Delivered, $order->fresh()->status);
    }

    public function test_mechanic_cannot_sell_and_other_company_sales_are_hidden(): void
    {
        $mechanic = $this->userWithRole(UserRole::Mechanic, $this->company);
        $this->actingAs($mechanic)->get(route('sales.index'))->assertForbidden();
        $this->actingAs($mechanic)->post(route('sales.store'), [])->assertForbidden();

        $otherCustomer = $this->makeFor($this->otherCompany, Customer::factory());
        $foreign = new Sale(['customer_id' => $otherCustomer->id]);
        $foreign->forceFill(['company_id' => $this->otherCompany->id, 'number' => 1, 'issued_at' => now(), 'subtotal' => 0, 'igv' => 0, 'total' => 0, 'status' => 'registered'])->save();

        $this->actingAs($this->admin)->get(route('sales.show', $foreign))->assertNotFound();
        $this->actingAs($this->admin)->post(route('sales.void', $foreign), ['reason' => 'Intento ajeno'])->assertNotFound();

        // Un producto de otro taller no puede venderse.
        $foreignProduct = $this->makeFor($this->otherCompany, Product::factory());
        $this->actingAs($this->admin)->post(route('sales.store'), [
            'customer_id' => $this->customer->id,
            'items' => [['type' => 'product', 'product_id' => $foreignProduct->id, 'quantity' => 1]],
            'payments' => [['method' => 'cash', 'amount' => '30']],
        ])->assertSessionHasErrors('items.0.product_id');
    }
}
