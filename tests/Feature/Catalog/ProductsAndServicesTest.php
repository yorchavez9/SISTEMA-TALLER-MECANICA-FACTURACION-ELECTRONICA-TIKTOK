<?php

namespace Tests\Feature\Catalog;

use App\Enums\UserRole;
use App\Models\DetractionType;
use App\Models\Product;
use App\Models\Service;
use App\Models\StockMovement;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ProductsAndServicesTest extends CatalogTestCase
{
    /**
     * @return array<string, mixed>
     */
    private function productPayload(array $overrides = []): array
    {
        return array_merge([
            'code' => 'fil-001',
            'name' => 'Filtro de aceite',
            'cost' => '15.50',
            'sale_price' => '32.00',
            'initial_stock' => '10',
            'min_stock' => '3',
            'unit' => 'NIU',
            'igv_affectation' => '10',
            'is_active' => true,
        ], $overrides);
    }

    public function test_product_without_image_is_created_with_initial_stock_movement(): void
    {
        $this->actingAs($this->admin)->post(route('products.store'), $this->productPayload())->assertSessionHasNoErrors();

        $product = Product::query()->withoutGlobalScopes()->sole();
        $this->assertSame('FIL-001', $product->code);
        $this->assertNull($product->image);
        $this->assertNull($product->thumbUrl());
        $this->assertEquals(10, (float) $product->stock);

        $movement = StockMovement::query()->withoutGlobalScopes()->sole();
        $this->assertSame('in', $movement->type);
        $this->assertEquals(10, (float) $movement->balance_after);
    }

    public function test_product_image_is_reencoded_replaced_and_removed(): void
    {
        Storage::fake('public');

        $this->actingAs($this->admin)->post(route('products.store'), $this->productPayload([
            'image' => UploadedFile::fake()->image('foto.jpg', 1600, 1200),
        ]))->assertSessionHasNoErrors();

        $product = Product::query()->withoutGlobalScopes()->sole();
        $first = $product->image;
        $this->assertMatchesRegularExpression('#^companies/'.$this->company->id.'/products/[0-9a-f-]{36}\.webp$#', $first);
        Storage::disk('public')->assertExists([$first, Product::thumbPath($first)]);

        // Reemplazo: borra el archivo anterior.
        $this->actingAs($this->admin)->post(route('products.update', $product), [
            ...$this->productPayload(['initial_stock' => null]),
            '_method' => 'PUT',
            'image' => UploadedFile::fake()->image('otra.png', 400, 400),
        ])->assertSessionHasNoErrors();

        $second = $product->fresh()->image;
        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing([$first, Product::thumbPath($first)]);
        Storage::disk('public')->assertExists($second);

        // Eliminación de la imagen.
        $this->actingAs($this->admin)->post(route('products.update', $product), [
            ...$this->productPayload(['initial_stock' => null]),
            '_method' => 'PUT',
            'remove_image' => true,
        ])->assertSessionHasNoErrors();

        $this->assertNull($product->fresh()->image);
        Storage::disk('public')->assertMissing($second);
    }

    public function test_disguised_or_invalid_files_are_rejected(): void
    {
        Storage::fake('public');

        $fakePhp = UploadedFile::fake()->createWithContent('foto.jpg', '<?php echo "hola"; ?>');
        $this->actingAs($this->admin)->post(route('products.store'), $this->productPayload(['image' => $fakePhp]))
            ->assertSessionHasErrors('image');

        $gif = UploadedFile::fake()->image('anim.gif');
        $this->actingAs($this->admin)->post(route('products.store'), $this->productPayload(['code' => 'X2', 'image' => $gif]))
            ->assertSessionHasErrors('image');

        $big = UploadedFile::fake()->image('grande.jpg')->size(3000);
        $this->actingAs($this->admin)->post(route('products.store'), $this->productPayload(['code' => 'X3', 'image' => $big]))
            ->assertSessionHasErrors('image');

        $this->assertSame(0, Product::query()->withoutGlobalScopes()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_stock_cannot_be_edited_directly_and_adjustments_create_movements(): void
    {
        $product = $this->makeFor($this->company, Product::factory());

        // "stock" no es asignable desde el formulario de edición.
        $this->actingAs($this->admin)->put(route('products.update', $product), [
            ...$this->productPayload(['code' => $product->code, 'initial_stock' => null]),
            'stock' => 999,
        ])->assertSessionHasNoErrors();
        $this->assertEquals(0, (float) $product->fresh()->stock);

        $this->actingAs($this->admin)->post(route('products.stock.adjust', $product), ['mode' => 'add', 'quantity' => '12', 'reason' => 'Compra a proveedor'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post(route('products.stock.adjust', $product), ['mode' => 'subtract', 'quantity' => '2', 'reason' => 'Merma'])->assertSessionHasNoErrors();
        $this->actingAs($this->admin)->post(route('products.stock.adjust', $product), ['mode' => 'set', 'quantity' => '7', 'reason' => 'Inventario físico'])->assertSessionHasNoErrors();

        $this->assertEquals(7, (float) $product->fresh()->stock);
        $this->assertSame(['in', 'out', 'adjust'], StockMovement::query()->withoutGlobalScopes()->orderBy('id')->pluck('type')->all());
        $this->assertEquals(-3, (float) StockMovement::query()->withoutGlobalScopes()->latest('id')->value('quantity'));
    }

    public function test_cashier_cannot_adjust_stock_or_manage_products(): void
    {
        $cashier = $this->userWithRole(UserRole::Cashier, $this->company);
        $product = $this->makeFor($this->company, Product::factory());

        $this->actingAs($cashier)->get(route('products.index'))->assertOk();
        $this->actingAs($cashier)->post(route('products.stock.adjust', $product), ['mode' => 'add', 'quantity' => '1', 'reason' => 'x'])->assertForbidden();
        $this->actingAs($cashier)->post(route('products.store'), $this->productPayload())->assertForbidden();
    }

    public function test_cannot_touch_another_company_products(): void
    {
        $foreign = $this->makeFor($this->otherCompany, Product::factory());

        $this->actingAs($this->admin)->get(route('products.show', $foreign))->assertNotFound();
        $this->actingAs($this->admin)->post(route('products.stock.adjust', $foreign), ['mode' => 'add', 'quantity' => '5', 'reason' => 'x'])->assertNotFound();
        $this->actingAs($this->admin)->delete(route('products.destroy', $foreign))->assertNotFound();
    }

    public function test_service_detraction_type_must_belong_to_company(): void
    {
        $foreignType = new DetractionType(['code' => '020', 'description' => 'X', 'rate' => 12]);
        $foreignType->company_id = $this->otherCompany->id;
        $foreignType->save();

        $this->actingAs($this->admin)->post(route('services.store'), [
            'name' => 'Afinamiento', 'price' => '150', 'igv_affectation' => '10', 'subject_to_detraction' => true,
            'detraction_type_id' => $foreignType->id,
        ])->assertSessionHasErrors('detraction_type_id');

        $this->actingAs($this->admin)->post(route('services.store'), [
            'name' => 'Afinamiento', 'price' => '150', 'igv_affectation' => '10', 'subject_to_detraction' => true,
        ])->assertSessionHasNoErrors();

        $service = Service::query()->withoutGlobalScopes()->sole();
        $this->assertSame($this->company->id, $service->company_id);
        $this->assertSame('150.00', $service->price);
    }
}
