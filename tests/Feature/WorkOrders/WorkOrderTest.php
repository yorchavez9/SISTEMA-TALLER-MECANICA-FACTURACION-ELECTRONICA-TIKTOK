<?php

namespace Tests\Feature\WorkOrders;

use App\Enums\UserRole;
use App\Enums\WorkOrderStatus;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Services\Sales\TaxCalculator;
use App\Enums\IgvAffectation;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Feature\Catalog\CatalogTestCase;

class WorkOrderTest extends CatalogTestCase
{
    private Customer $customer;

    private Vehicle $vehicle;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = $this->makeFor($this->company, Customer::factory());
        $this->vehicle = $this->makeFor($this->company, Vehicle::factory(), ['customer_id' => $this->customer->id, 'current_mileage' => 40000]);
    }

    private function createOrder(array $overrides = []): WorkOrder
    {
        $this->actingAs($this->admin)->post(route('work-orders.store'), array_merge([
            'customer_id' => $this->customer->id,
            'vehicle_id' => $this->vehicle->id,
            'mileage_in' => 45200,
            'reported_problem' => 'Ruido al frenar y testigo de aceite encendido.',
        ], $overrides))->assertSessionHasNoErrors();

        return WorkOrder::query()->withoutGlobalScopes()->latest('id')->firstOrFail();
    }

    public function test_work_order_is_created_with_sequential_number_and_updates_mileage(): void
    {
        $first = $this->createOrder();
        $second = $this->createOrder(['mileage_in' => 30000]); // menor: no reduce el kilometraje

        $this->assertSame(1, $first->number);
        $this->assertSame('OT-000001', $first->code());
        $this->assertSame(2, $second->number);
        $this->assertSame(WorkOrderStatus::Pending, $first->status);
        $this->assertSame(45200, $this->vehicle->fresh()->current_mileage);
    }

    public function test_numbering_is_independent_per_company(): void
    {
        $otherCustomer = $this->makeFor($this->otherCompany, Customer::factory());
        $otherVehicle = $this->makeFor($this->otherCompany, Vehicle::factory(), ['customer_id' => $otherCustomer->id]);
        $otherAdmin = $this->userWithRole(UserRole::CompanyAdmin, $this->otherCompany);

        $this->createOrder();
        $this->actingAs($otherAdmin)->post(route('work-orders.store'), [
            'customer_id' => $otherCustomer->id, 'vehicle_id' => $otherVehicle->id, 'reported_problem' => 'Afinamiento',
        ])->assertSessionHasNoErrors();

        $this->assertSame(1, WorkOrder::query()->withoutGlobalScopes()->where('company_id', $this->otherCompany->id)->value('number'));
    }

    public function test_vehicle_must_belong_to_the_selected_customer(): void
    {
        $otherCustomer = $this->makeFor($this->company, Customer::factory());

        $this->actingAs($this->admin)->post(route('work-orders.store'), [
            'customer_id' => $otherCustomer->id,
            'vehicle_id' => $this->vehicle->id,
            'reported_problem' => 'X problema',
        ])->assertSessionHasErrors('vehicle_id');
    }

    public function test_items_are_priced_server_side_with_igv_included(): void
    {
        $order = $this->createOrder();
        $service = $this->makeFor($this->company, Service::factory(), ['name' => 'Cambio de aceite', 'price' => 118]);
        $product = $this->makeFor($this->company, Product::factory(), ['sale_price' => 59, 'unit' => 'NIU']);

        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'service', 'service_id' => $service->id, 'quantity' => 1])->assertSessionHasNoErrors()->assertRedirect();
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'product', 'product_id' => $product->id, 'quantity' => 2])->assertSessionHasNoErrors()->assertRedirect();
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'labor', 'description' => 'Mano de obra frenos', 'quantity' => 1, 'unit_price' => 59, 'total' => 1])->assertSessionHasNoErrors();

        $order->refresh();
        // 118 + 2×59 + 59 = 295 con IGV → base 250.00, IGV 45.00
        $this->assertSame('295.00', $order->total);
        $this->assertSame('250.00', $order->subtotal);
        $this->assertSame('45.00', $order->igv);

        $items = $order->items()->get();
        $this->assertSame('Cambio de aceite', $items[0]->description);
        $this->assertSame('ZZ', $items[0]->unit);
        $this->assertSame('NIU', $items[1]->unit);
    }

    public function test_item_update_and_delete_recalculate_totals(): void
    {
        $order = $this->createOrder();
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'labor', 'description' => 'Diagnóstico', 'quantity' => 1, 'unit_price' => 100]);
        $item = $order->items()->firstOrFail();

        $this->actingAs($this->admin)->put(route('work-orders.items.update', [$order, $item]), ['description' => 'Diagnóstico computarizado', 'quantity' => 2, 'unit_price' => 50.5])->assertSessionHasNoErrors();
        $this->assertSame('101.00', $order->fresh()->total);

        $this->actingAs($this->admin)->delete(route('work-orders.items.destroy', [$order, $item]))->assertSessionHasNoErrors();
        $this->assertSame('0.00', $order->fresh()->total);
    }

    public function test_status_transitions_are_validated(): void
    {
        $order = $this->createOrder();

        // No se puede finalizar sin ítems ni saltar a entregada.
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'delivered'])->assertSessionHasErrors('status');
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'diagnosing'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'in_progress'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'finished'])->assertSessionHasErrors('status');

        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'labor', 'description' => 'MO', 'quantity' => 1, 'unit_price' => 80]);
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'finished', 'note' => 'Listo para entrega'])->assertSessionHasNoErrors();

        $order->refresh();
        $this->assertSame(WorkOrderStatus::Finished, $order->status);
        $this->assertNotNull($order->finished_at);

        // Finalizada: el contenido queda bloqueado.
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'labor', 'description' => 'Extra', 'quantity' => 1, 'unit_price' => 10])->assertSessionHasErrors('status');
        $this->actingAs($this->admin)->put(route('work-orders.update', $order), ['reported_problem' => 'Cambio'])->assertSessionHasErrors('status');

        // Historial de estados en la línea de tiempo.
        $this->actingAs($this->admin)->get(route('work-orders.show', $order))
            ->assertInertia(fn (Assert $page) => $page
                ->where('order.status', 'finished')
                ->where('order.editable', false)
                ->has('timeline', 4));
    }

    public function test_mechanic_can_work_but_cannot_cancel(): void
    {
        $mechanic = $this->userWithRole(UserRole::Mechanic, $this->company);
        $order = $this->createOrder();

        $this->actingAs($mechanic)->put(route('work-orders.update', $order), ['reported_problem' => 'Ruido', 'diagnosis' => 'Pastillas gastadas'])->assertSessionHasNoErrors();
        $this->actingAs($mechanic)->post(route('work-orders.status', $order), ['status' => 'cancelled'])->assertForbidden();
        $this->actingAs($this->admin)->post(route('work-orders.status', $order), ['status' => 'cancelled'])->assertSessionHasNoErrors();

        $this->assertSame(WorkOrderStatus::Cancelled, $order->fresh()->status);
        $this->assertSame('Pastillas gastadas', $order->fresh()->diagnosis);
    }

    public function test_cannot_access_or_modify_another_company_work_orders(): void
    {
        $otherCustomer = $this->makeFor($this->otherCompany, Customer::factory());
        $otherVehicle = $this->makeFor($this->otherCompany, Vehicle::factory(), ['customer_id' => $otherCustomer->id]);
        $foreign = new WorkOrder(['customer_id' => $otherCustomer->id, 'vehicle_id' => $otherVehicle->id, 'reported_problem' => 'X', 'received_at' => now()]);
        $foreign->company_id = $this->otherCompany->id;
        $foreign->number = 1;
        $foreign->status = WorkOrderStatus::Pending;
        $foreign->save();

        $this->actingAs($this->admin)->get(route('work-orders.show', $foreign))->assertNotFound();
        $this->actingAs($this->admin)->post(route('work-orders.status', $foreign), ['status' => 'cancelled'])->assertNotFound();
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $foreign), ['type' => 'labor', 'description' => 'X', 'quantity' => 1, 'unit_price' => 1])->assertNotFound();
        $this->actingAs($this->admin)->get(route('work-orders.print', $foreign))->assertNotFound();

        // Un servicio de otro taller no puede agregarse a una OT propia.
        $order = $this->createOrder();
        $foreignService = $this->makeFor($this->otherCompany, Service::factory());
        $this->actingAs($this->admin)->post(route('work-orders.items.store', $order), ['type' => 'service', 'service_id' => $foreignService->id, 'quantity' => 1])->assertSessionHasErrors('service_id');
    }

    public function test_print_sheet_renders(): void
    {
        $order = $this->createOrder();

        $this->actingAs($this->admin)->get(route('work-orders.print', $order))
            ->assertOk()
            ->assertSee('OT-000001')
            ->assertSee($this->vehicle->formattedPlate());
    }

    public function test_tax_calculator_handles_exempt_items(): void
    {
        $tax = new TaxCalculator;

        $this->assertSame(['subtotal' => 100.0, 'igv' => 0.0, 'total' => 100.0], $tax->line(1, 100, IgvAffectation::Exempt, 18));
        $this->assertSame(['subtotal' => 84.75, 'igv' => 15.25, 'total' => 100.0], $tax->line(1, 100, IgvAffectation::Taxed, 18));
    }
}
