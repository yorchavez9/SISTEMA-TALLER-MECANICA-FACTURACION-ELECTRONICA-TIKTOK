<?php

namespace Tests\Feature\Catalog;

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Vehicle;
use Inertia\Testing\AssertableInertia as Assert;

class CustomersAndVehiclesTest extends CatalogTestCase
{
    public function test_customer_is_created_with_normalized_data(): void
    {
        $this->actingAs($this->admin)->post(route('customers.store'), [
            'document_type' => '6',
            'document_number' => '20131312955',
            'name' => 'transportes   san martin sac',
            'address' => 'av. industrial 456',
            'email' => 'CONTACTO@SANMARTIN.PE',
            'phone' => '999 888 777',
        ])->assertSessionHasNoErrors();

        $customer = Customer::query()->withoutGlobalScopes()->sole();
        $this->assertSame($this->company->id, $customer->company_id);
        $this->assertSame('TRANSPORTES SAN MARTIN SAC', $customer->name);
        $this->assertSame('contacto@sanmartin.pe', $customer->email);
    }

    public function test_document_numbers_are_validated(): void
    {
        $cases = [
            ['1', '1234567'],       // DNI corto
            ['6', '20131312954'],   // RUC con dígito verificador incorrecto
            ['6', '123'],
        ];

        foreach ($cases as [$type, $number]) {
            $this->actingAs($this->admin)
                ->post(route('customers.store'), ['document_type' => $type, 'document_number' => $number, 'name' => 'X'])
                ->assertSessionHasErrors('document_number');
        }

        // Sin documento: número opcional.
        $this->actingAs($this->admin)
            ->post(route('customers.store'), ['document_type' => '0', 'name' => 'CLIENTE VARIOS'])
            ->assertSessionHasNoErrors();
    }

    public function test_document_is_unique_per_company_but_not_across_companies(): void
    {
        $this->makeFor($this->company, Customer::factory(), ['document_number' => '12345678']);
        $this->makeFor($this->otherCompany, Customer::factory(), ['document_number' => '87654321']);

        $this->actingAs($this->admin)
            ->post(route('customers.store'), ['document_type' => '1', 'document_number' => '12345678', 'name' => 'Duplicado'])
            ->assertSessionHasErrors('document_number');

        // El mismo DNI que tiene otro taller sí se permite.
        $this->actingAs($this->admin)
            ->post(route('customers.store'), ['document_type' => '1', 'document_number' => '87654321', 'name' => 'Permitido'])
            ->assertSessionHasNoErrors();
    }

    public function test_vehicle_plate_is_normalized_and_unique(): void
    {
        $customer = $this->makeFor($this->company, Customer::factory());

        $this->actingAs($this->admin)->post(route('vehicles.store'), [
            'customer_id' => $customer->id, 'plate' => 'abc-123', 'brand' => 'toyota', 'model' => 'hilux', 'current_mileage' => 85000,
        ])->assertSessionHasNoErrors();

        $vehicle = Vehicle::query()->withoutGlobalScopes()->sole();
        $this->assertSame('ABC123', $vehicle->plate);
        $this->assertSame('ABC-123', $vehicle->formattedPlate());
        $this->assertSame(85000, $vehicle->current_mileage);

        $this->actingAs($this->admin)->post(route('vehicles.store'), [
            'customer_id' => $customer->id, 'plate' => 'ABC 123', 'brand' => 'X', 'model' => 'Y',
        ])->assertSessionHasErrors('plate');
    }

    public function test_vehicle_cannot_be_assigned_to_another_company_customer(): void
    {
        $foreign = $this->makeFor($this->otherCompany, Customer::factory());

        $this->actingAs($this->admin)->post(route('vehicles.store'), [
            'customer_id' => $foreign->id, 'plate' => 'XYZ789', 'brand' => 'X', 'model' => 'Y',
        ])->assertSessionHasErrors('customer_id');
    }

    public function test_customer_with_vehicles_cannot_be_deleted(): void
    {
        $customer = $this->makeFor($this->company, Customer::factory());
        $this->makeFor($this->company, Vehicle::factory(), ['customer_id' => $customer->id]);

        $this->actingAs($this->admin)->delete(route('customers.destroy', $customer))->assertSessionHasErrors('api');
        $this->assertNotSoftDeleted($customer);
    }

    public function test_cannot_access_another_company_customers_or_vehicles(): void
    {
        $foreign = $this->makeFor($this->otherCompany, Customer::factory());
        $foreignVehicle = $this->makeFor($this->otherCompany, Vehicle::factory(), ['customer_id' => $foreign->id]);

        $this->actingAs($this->admin)->get(route('customers.show', $foreign))->assertNotFound();
        $this->actingAs($this->admin)->put(route('customers.update', $foreign), ['document_type' => '0', 'name' => 'X'])->assertNotFound();
        $this->actingAs($this->admin)->delete(route('customers.destroy', $foreign))->assertNotFound();
        $this->actingAs($this->admin)->delete(route('vehicles.destroy', $foreignVehicle))->assertNotFound();

        $this->actingAs($this->admin)->get(route('customers.index'))
            ->assertInertia(fn (Assert $page) => $page->has('customers.data', 0));

        $this->actingAs($this->admin)->getJson(route('customers.search', ['q' => $foreign->name]))
            ->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_mechanic_can_view_but_not_manage_customers(): void
    {
        $mechanic = $this->userWithRole(UserRole::Mechanic, $this->company);
        $customer = $this->makeFor($this->company, Customer::factory());

        $this->actingAs($mechanic)->get(route('customers.index'))->assertOk();
        $this->actingAs($mechanic)->get(route('customers.show', $customer))->assertOk();
        $this->actingAs($mechanic)->post(route('customers.store'), ['document_type' => '0', 'name' => 'X'])->assertForbidden();
        $this->actingAs($mechanic)->delete(route('customers.destroy', $customer))->assertForbidden();
    }
}
