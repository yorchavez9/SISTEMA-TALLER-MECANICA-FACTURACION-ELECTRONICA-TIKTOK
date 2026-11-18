<?php

namespace Tests\Feature\Documents;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Customer;
use App\Models\DetractionType;
use App\Models\DocumentSeries;
use App\Models\ElectronicDocument;
use App\Models\Establishment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Service;
use App\Models\User;
use App\Services\Inventory\StockService;
use App\Services\Sales\SaleService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Catalog\CatalogTestCase;

class ElectronicDocumentTest extends CatalogTestCase
{
    private Customer $rucCustomer;

    private Customer $dniCustomer;

    private Product $product;

    private Service $service;

    protected function setUp(): void
    {
        parent::setUp();

        config(['sunat_api.base_url' => 'https://api.test/api/v1', 'sunat_api.root_url' => 'https://api.test/api']);

        // Taller listo para facturar, con series y detracción configuradas.
        $this->company = Company::factory()->provisioned()->create();
        $this->admin = $this->userWithRole(UserRole::CompanyAdmin, $this->company);
        $this->company->billingSettings->forceFill(['detraction_account' => '00-123-456789'])->save();

        $main = Establishment::query()->withoutGlobalScopes()->where('company_id', $this->company->id)->firstOrFail();
        foreach (['F001' => '01', 'B001' => '03', 'FC01' => '07', 'BC01' => '07'] as $serie => $type) {
            $s = new DocumentSeries(['establishment_id' => $main->id, 'document_type' => DocumentType::from($type), 'series' => $serie, 'is_active' => true]);
            $s->company_id = $this->company->id;
            $s->save();
        }

        $detraction = new DetractionType(['code' => '020', 'description' => 'Mantenimiento', 'rate' => 12, 'is_active' => true, 'is_default' => true]);
        $detraction->company_id = $this->company->id;
        $detraction->save();

        $this->rucCustomer = $this->makeFor($this->company, Customer::factory(), ['document_type' => '6', 'document_number' => '20131312955', 'name' => 'TRANSPORTES SAC']);
        $this->dniCustomer = $this->makeFor($this->company, Customer::factory(), ['document_type' => '1', 'document_number' => '72243561']);
        $this->product = $this->makeFor($this->company, Product::factory(), ['sale_price' => 59, 'code' => 'FIL-01']);
        $this->service = $this->makeFor($this->company, Service::factory(), ['price' => 118, 'subject_to_detraction' => true, 'sunat_product_code' => '78181500']);

        $this->actingAs($this->admin);
        app(CurrentCompany::class)->set($this->company);
        app(StockService::class)->move($this->product, 20, 'in', 'Stock inicial');
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function sale(Customer $customer, array $items): Sale
    {
        app(CurrentCompany::class)->set($this->company);
        $total = 0;
        foreach ($items as $i) {
            $total += $i['quantity'] * ($i['unit_price'] ?? ($i['type'] === 'service' ? 118 : 59));
        }

        return app(SaleService::class)->direct($this->company, $customer, $items, [['method' => 'cash', 'amount' => $total]]);
    }

    private function smallInvoiceSale(): Sale
    {
        return $this->sale($this->rucCustomer, [
            ['type' => 'service', 'service_id' => $this->service->id, 'quantity' => 1],
            ['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 2],
        ]); // 118 + 118 = 236
    }

    private function fakeCreated(string $status = 'enviado', int $id = 55): void
    {
        Http::fake([
            'api.test/api/v1/facturas' => Http::response(['estado' => 'exito', 'datos' => ['id' => $id, 'serie' => 'F001', 'correlativo' => 1, 'sunat_status' => $status]], 201),
            'api.test/api/v1/boletas' => Http::response(['estado' => 'exito', 'datos' => ['id' => $id, 'serie' => 'B001', 'correlativo' => 1, 'sunat_status' => $status]], 201),
        ]);
    }

    public function test_invoice_is_issued_with_collection_fields_and_explicit_correlativo(): void
    {
        $this->fakeCreated();
        $sale = $this->smallInvoiceSale();

        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertSessionHasNoErrors()->assertRedirect();

        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame('F001-1', $doc->fullNumber());
        $this->assertSame(DocumentStatus::Sent, $doc->local_status);
        $this->assertSame(55, $doc->api_document_id);
        $this->assertSame('sale:'.$sale->id, $doc->issuance_key);
        $this->assertSame($this->company->ruc, $doc->issuer_ruc);
        $this->assertSame('beta', $doc->environment);

        Http::assertSent(function (HttpRequest $r) {
            if (! str_ends_with($r->url(), '/facturas')) {
                return false;
            }
            $b = $r->data();

            return $r->header('X-Api-Key')[0] === 'test-key-'.$this->company->id
                && $b['serie'] === 'F001' && $b['correlativo'] === 1
                && $b['tipo_operacion'] === '0101' && $b['tipo_moneda'] === 'PEN' && $b['forma_pago'] === 'Contado'
                && $b['cliente']['tipo_doc'] === '6' && $b['cliente']['num_doc'] === '20131312955'
                && $b['items'][0]['precio_unitario'] == 118 && $b['items'][0]['unidad'] === 'ZZ'
                && $b['items'][0]['tip_afe_igv'] === '10' && $b['items'][0]['cod_producto_sunat'] === '78181500'
                && $b['items'][1]['unidad'] === 'NIU' && $b['items'][1]['cantidad'] == 2
                && ! isset($b['detraccion']); // 236 < 700
        });

        $this->assertSame(1, DocumentSeries::query()->withoutGlobalScopes()->where('series', 'F001')->value('last_number'));
    }

    public function test_status_refresh_marks_accepted(): void
    {
        $this->fakeCreated();
        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();

        Http::fake(['api.test/api/v1/facturas/55' => Http::response(['estado' => 'exito', 'datos' => ['id' => 55, 'sunat_status' => 'aceptado', 'sunat_code' => '0', 'sunat_description' => 'La Factura numero F001-1, ha sido aceptada']])]);

        $this->post(route('documents.refresh', $doc))->assertSessionHasNoErrors();

        $doc->refresh();
        $this->assertSame(DocumentStatus::Accepted, $doc->local_status);
        $this->assertSame('0', $doc->sunat_code);
        $this->assertNotNull($doc->accepted_at);
    }

    public function test_a_sale_cannot_get_two_documents(): void
    {
        $this->fakeCreated();
        $sale = $this->smallInvoiceSale();

        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertSessionHasNoErrors();
        $this->post(route('documents.issue', $sale), ['document_type' => '03'])->assertSessionHasErrors('document');

        $this->assertSame(1, ElectronicDocument::query()->withoutGlobalScopes()->count());
        Http::assertSentCount(1);
    }

    public function test_invoice_requires_ruc_and_boleta_rules(): void
    {
        $this->fakeCreated();
        $sale = $this->sale($this->dniCustomer, [['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 1]]);

        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertSessionHasErrors('document_type');
        Http::assertNothingSent();

        $this->post(route('documents.issue', $sale), ['document_type' => '03'])->assertSessionHasNoErrors();
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/boletas') && $r->data()['cliente']['tipo_doc'] === '1' && $r->data()['solo_registro'] === false);

        // Consumidor sin documento: solo boletas menores a S/ 700.
        $anonymous = $this->makeFor($this->company, Customer::factory(), ['document_type' => '0', 'document_number' => null, 'name' => 'CLIENTES VARIOS']);
        $big = $this->sale($anonymous, [['type' => 'product', 'product_id' => $this->product->id, 'quantity' => 12]]); // 708
        $this->post(route('documents.issue', $big), ['document_type' => '03'])->assertSessionHasErrors('document_type');
    }

    public function test_timeout_leaves_document_unknown_and_never_reposts_without_verification(): void
    {
        Http::fake(['api.test/api/v1/facturas' => fn () => throw new ConnectionException('timeout')]);
        $sale = $this->smallInvoiceSale();

        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertRedirect();
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame(DocumentStatus::Unknown, $doc->local_status);

        // No se puede emitir otro ni reintentar sin verificar.
        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertSessionHasErrors('document');
        $this->post(route('documents.retry', $doc))->assertSessionHasErrors('document');

        // Verificación: la API sí lo registró → se adopta sin reenviar.
        Http::fake(['api.test/api/v1/facturas*' => Http::response(['estado' => 'exito', 'datos' => [['id' => 77, 'serie' => 'F001', 'correlativo' => 1, 'sunat_status' => 'aceptado']]])]);
        $this->post(route('documents.verify', $doc))->assertSessionHasNoErrors();

        $doc->refresh();
        $this->assertSame(DocumentStatus::Accepted, $doc->local_status);
        $this->assertSame(77, $doc->api_document_id);
        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'GET' && str_contains($r->url(), 'serie=F001') && str_contains($r->url(), 'correlativo=1'));
        Http::assertNotSent(fn (HttpRequest $r) => $r->method() === 'POST');
    }

    public function test_unknown_not_found_after_grace_period_allows_retry_with_same_number(): void
    {
        // Secuencia: 1.er POST sin respuesta → GET de verificación vacío → 2.º POST registrado.
        $posts = 0;
        Http::fake(function (HttpRequest $r) use (&$posts) {
            if ($r->method() === 'GET') {
                return Http::response(['estado' => 'exito', 'datos' => []]);
            }

            if (++$posts === 1) {
                throw new ConnectionException('timeout');
            }

            return Http::response(['estado' => 'exito', 'datos' => ['id' => 56, 'sunat_status' => 'enviado']], 201);
        });

        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame(DocumentStatus::Unknown, $doc->local_status);

        // Antes del margen de seguridad, "no encontrado" no es concluyente.
        $this->post(route('documents.verify', $doc));
        $this->assertSame(DocumentStatus::Unknown, $doc->fresh()->local_status);

        $this->travel(3)->minutes();
        $this->post(route('documents.verify', $doc));
        $this->assertSame(DocumentStatus::Failed, $doc->fresh()->local_status);

        $this->post(route('documents.retry', $doc))->assertSessionHasNoErrors();

        $doc->refresh();
        $this->assertSame(DocumentStatus::Sent, $doc->local_status);
        $this->assertSame('F001-1', $doc->fullNumber());
        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'POST' && $r->data()['correlativo'] === 1);
    }

    public function test_api_validation_error_marks_failed_and_discard_releases_number(): void
    {
        Http::fake(['api.test/api/v1/facturas' => Http::response(['estado' => 'error', 'mensaje' => 'Error de validación', 'errores' => ['cliente.num_doc' => ['RUC no válido en SUNAT']]], 422)]);
        $sale = $this->smallInvoiceSale();

        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame(DocumentStatus::Failed, $doc->local_status);
        $this->assertStringContainsString('RUC no válido', $doc->last_error);

        // La venta no se puede anular mientras el intento siga vigente.
        $this->post(route('sales.void', $sale), ['reason' => 'Prueba de anulación'])->assertSessionHasErrors('void');

        $this->delete(route('documents.discard', $doc))->assertSessionHasNoErrors();
        $this->assertSame(0, ElectronicDocument::query()->withoutGlobalScopes()->count());
        $this->assertSame(0, DocumentSeries::query()->withoutGlobalScopes()->where('series', 'F001')->value('last_number'));

        $this->post(route('sales.void', $sale), ['reason' => 'Prueba de anulación'])->assertSessionHasNoErrors();
    }

    public function test_detraction_is_chosen_at_emission_with_dynamic_rate(): void
    {
        $this->fakeCreated();
        // 7 servicios × 118 = 826 > 700
        $sale = $this->sale($this->rucCustomer, [['type' => 'service', 'service_id' => $this->service->id, 'quantity' => 7]]);
        $type = DetractionType::query()->withoutGlobalScopes()->sole();

        // Sugerida pero no aplicada sin motivo → error.
        $this->post(route('documents.issue', $sale), ['document_type' => '01', 'detraction' => ['apply' => false]])
            ->assertSessionHasErrors('detraction.override_reason');

        // Aplicada con un % distinto al del tipo (dinámico).
        $this->post(route('documents.issue', $sale), [
            'document_type' => '01',
            'detraction' => ['apply' => true, 'type_id' => $type->id, 'rate' => '10'],
        ])->assertSessionHasNoErrors();

        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/facturas')
            && $r->data()['detraccion'] === [
                'tipo_operacion' => '1001', 'cod_bien' => '020', 'cod_medio_pago' => '001',
                'cta_banco' => '00-123-456789', 'porcentaje' => 10, 'monto' => 82.6,
            ]);

        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame('82.60', $doc->detraction_amount);
        $this->assertSame('10.00', $doc->detraction_rate);
        $this->assertStringContainsString('12.00 % → 10 %', (string) $doc->detraction_override_reason);
    }

    public function test_credit_note_voids_document_sale_and_returns_stock_when_accepted(): void
    {
        $this->fakeCreated('aceptado');
        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $invoice = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $this->assertSame(DocumentStatus::Accepted, $invoice->local_status);
        $this->assertEquals(18, (float) $this->product->fresh()->stock);

        // Venta con comprobante aceptado: solo se anula con NC.
        $this->post(route('sales.void', $sale), ['reason' => 'Intento directo'])->assertSessionHasErrors('void');

        Http::fake(['api.test/api/v1/notas-credito' => Http::response(['estado' => 'exito', 'datos' => ['id' => 90, 'sunat_status' => 'enviado']], 201)]);
        $this->post(route('documents.credit-note', $invoice), ['description' => 'Anulación de la operación'])->assertSessionHasNoErrors();

        $note = ElectronicDocument::query()->withoutGlobalScopes()->where('document_type', '07')->sole();
        $this->assertSame('FC01-1', $note->fullNumber());
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/notas-credito')
            && $r->data()['doc_afectado_tipo'] === '01' && $r->data()['doc_afectado_serie'] === 'F001'
            && $r->data()['doc_afectado_correlativo'] === '1' && $r->data()['cod_motivo'] === '01');

        // Al aceptarse la NC: comprobante y venta anulados, stock devuelto.
        Http::fake(['api.test/api/v1/notas-credito/90' => Http::response(['estado' => 'exito', 'datos' => ['id' => 90, 'sunat_status' => 'aceptado']])]);
        $this->post(route('documents.refresh', $note))->assertSessionHasNoErrors();

        $this->assertSame(DocumentStatus::Voided, $invoice->fresh()->local_status);
        $this->assertSame(Sale::STATUS_VOIDED, $sale->fresh()->status);
        $this->assertEquals(20, (float) $this->product->fresh()->stock);

        // No se admite una segunda NC sobre el mismo comprobante.
        $this->post(route('documents.credit-note', $invoice), ['description' => 'Otra vez'])->assertSessionHasErrors('credit_note');
    }

    public function test_company_not_ready_cannot_issue(): void
    {
        $this->company->billingSettings->forceFill(['api_key' => null, 'api_secret' => null])->save();
        Http::fake();
        $sale = $this->smallInvoiceSale();

        $this->post(route('documents.issue', $sale), ['document_type' => '01'])->assertSessionHasErrors('document');
        Http::assertNothingSent();
    }

    public function test_scheduler_only_reads_statuses(): void
    {
        $this->fakeCreated();
        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();
        $doc->forceFill(['next_check_at' => now()->subMinute()])->save();
        app(CurrentCompany::class)->set(null);

        Http::fake(['api.test/api/v1/facturas/55' => Http::response(['estado' => 'exito', 'datos' => ['id' => 55, 'sunat_status' => 'aceptado']])]);
        $this->artisan('sunat:sync-pending')->assertSuccessful();

        $this->assertSame(DocumentStatus::Accepted, $doc->fresh()->local_status);
        Http::assertNotSent(fn (HttpRequest $r) => $r->method() !== 'GET');
    }

    public function test_files_are_proxied_and_xml_cached_after_acceptance(): void
    {
        Storage::fake('local');
        $this->fakeCreated('aceptado');
        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();

        Http::fake([
            'api.test/api/v1/facturas/55/pdf*' => Http::response('%PDF-1.4 fake', 200, ['Content-Type' => 'application/pdf']),
            'api.test/api/v1/facturas/55/xml' => Http::response('<Invoice/>', 200, ['Content-Type' => 'application/xml']),
        ]);

        $this->get(route('documents.file', ['document' => $doc, 'kind' => 'pdf', 'format' => 'ticket-80']))
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'pdf?format=ticket-80'));

        $this->get(route('documents.file', ['document' => $doc, 'kind' => 'xml']))->assertOk();
        $this->assertNotNull($doc->fresh()->xml_path);
        Storage::disk('local')->assertExists($doc->fresh()->xml_path);
    }

    public function test_isolation_and_permissions(): void
    {
        $this->fakeCreated();
        $sale = $this->smallInvoiceSale();
        $this->post(route('documents.issue', $sale), ['document_type' => '01']);
        $doc = ElectronicDocument::query()->withoutGlobalScopes()->sole();

        $mechanic = $this->userWithRole(UserRole::Mechanic, $this->company);
        $this->actingAs($mechanic)->post(route('documents.refresh', $doc))->assertForbidden();
        $this->actingAs($mechanic)->get(route('documents.index'))->assertForbidden();

        $other = Company::factory()->provisioned()->create();
        $otherAdmin = User::factory()->create();
        $otherAdmin->forceFill(['company_id' => $other->id])->save();
        $otherAdmin->assignRole(UserRole::CompanyAdmin->value);

        $this->actingAs($otherAdmin)->post(route('documents.refresh', $doc))->assertNotFound();
        $this->actingAs($otherAdmin)->get(route('documents.file', ['document' => $doc, 'kind' => 'pdf']))->assertNotFound();
        $this->actingAs($otherAdmin)->post(route('documents.credit-note', $doc), ['description' => 'Ajeno'])->assertNotFound();
    }
}
