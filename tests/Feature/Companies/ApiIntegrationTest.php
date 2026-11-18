<?php

namespace Tests\Feature\Companies;

use App\Enums\BillingStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Models\ApiOperationLog;
use App\Models\Company;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Integración con la API SUNAT simulada (Http::fake).
 */
class ApiIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        config(['sunat_api.base_url' => 'https://api.test/api/v1', 'sunat_api.root_url' => 'https://api.test/api']);

        $this->superAdmin = User::factory()->create();
        $this->superAdmin->assignRole(UserRole::SuperAdmin->value);
    }

    private function companyWithSeries(): Company
    {
        $company = Company::factory()->create(['api_plan' => 'pro']);
        $main = Establishment::query()->withoutGlobalScopes()->where('company_id', $company->id)->firstOrFail();

        foreach (['F001' => '01', 'B001' => '03'] as $serie => $type) {
            $series = new DocumentSeries(['establishment_id' => $main->id, 'document_type' => DocumentType::from($type), 'series' => $serie, 'is_active' => true]);
            $series->company_id = $company->id;
            $series->save();
        }

        return $company;
    }

    /**
     * @return array<string, mixed>
     */
    private function provisionPayload(): array
    {
        return [
            'certificate' => UploadedFile::fake()->createWithContent('certificado.pfx', 'contenido-binario-pfx'),
            'certificate_password' => 'clave-del-certificado',
            'sol_user' => 'MODDATOS',
            'sol_pass' => 'clave-sol-secreta',
        ];
    }

    public function test_provisioning_registers_stores_encrypted_credentials_and_syncs(): void
    {
        $company = $this->companyWithSeries();

        Http::fake([
            'api.test/api/v1/registro' => Http::response(['estado' => 'exito', 'mensaje' => 'Registrado', 'datos' => ['api_key' => 'pk_live_123', 'api_secret' => 'sk_live_456']], 201),
            'api.test/api/v1/empresa' => Http::sequence()
                ->push(['estado' => 'exito', 'datos' => []])                                  // PUT /empresa
                ->push(['estado' => 'exito', 'datos' => ['tax_regime' => 'general', 'tasa_igv_vigente' => 18]]), // GET /empresa
            'api.test/api/v1/sucursales*' => Http::response(['estado' => 'exito', 'datos' => [['id' => 7, 'cod_local' => '0000', 'es_principal' => true]]]),
            'api.test/api/v1/series*' => Http::sequence()
                ->push(['estado' => 'exito', 'datos' => [['id' => 31, 'serie' => 'F001', 'tipo' => 'factura']]]) // GET /series
                ->push(['estado' => 'exito', 'datos' => [['id' => 32, 'serie' => 'B001']]]),                     // POST /series (B001)
        ]);

        $this->actingAs($this->superAdmin)
            ->post(route('admin.companies.billing.provision', $company), $this->provisionPayload())
            ->assertSessionHasNoErrors();

        $settings = $company->billingSettings()->first();
        $this->assertSame(BillingStatus::Ready, $settings->status);
        $this->assertSame('pk_live_123', $settings->api_key);
        $this->assertSame('sk_live_456', $settings->api_secret);
        $this->assertEquals(18, $settings->igv_rate);
        $this->assertNotNull($settings->certificate_uploaded_at);

        // Cifrado en la base de datos.
        $raw = DB::table('company_billing_settings')->where('company_id', $company->id)->first();
        $this->assertStringNotContainsString('sk_live_456', (string) $raw->api_secret);

        // Vinculación de sucursal y series.
        $this->assertSame(7, Establishment::query()->withoutGlobalScopes()->where('company_id', $company->id)->value('api_branch_id'));
        $this->assertSame(31, DocumentSeries::query()->withoutGlobalScopes()->where('series', 'F001')->value('api_series_id'));
        $this->assertSame(32, DocumentSeries::query()->withoutGlobalScopes()->where('series', 'B001')->value('api_series_id'));

        // El registro se envió con el plan y entorno asignados, y sin credenciales en cabeceras.
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/registro')
            && ! $r->hasHeader('X-Api-Key')
            && str_contains($r->body(), 'name="plan"')
            && str_contains($r->body(), 'pro'));

        // Las llamadas posteriores sí usan las credenciales del taller.
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/empresa') && $r->method() === 'PUT' && $r->header('X-Api-Key')[0] === 'pk_live_123');
    }

    public function test_api_logs_never_contain_secrets(): void
    {
        $company = $this->companyWithSeries();

        Http::fake([
            'api.test/api/v1/registro' => Http::response(['estado' => 'exito', 'datos' => ['api_key' => 'pk_live_123', 'api_secret' => 'sk_live_456']]),
            'api.test/*' => Http::response(['estado' => 'exito', 'datos' => []]),
        ]);

        $this->actingAs($this->superAdmin)->post(route('admin.companies.billing.provision', $company), $this->provisionPayload());

        $dump = ApiOperationLog::query()->withoutGlobalScopes()->get()->toJson();

        $this->assertNotEmpty($dump);
        foreach (['sk_live_456', 'pk_live_123', 'clave-sol-secreta', 'clave-del-certificado', 'contenido-binario-pfx'] as $secret) {
            $this->assertStringNotContainsString($secret, $dump, "El log contiene un dato sensible: {$secret}");
        }
    }

    public function test_api_validation_error_is_shown_and_status_marked(): void
    {
        $company = $this->companyWithSeries();

        Http::fake([
            'api.test/api/v1/registro' => Http::response(['estado' => 'error', 'mensaje' => 'Error de validación', 'errores' => ['certificado' => ['Contraseña del certificado incorrecta.']]], 422),
        ]);

        $this->actingAs($this->superAdmin)
            ->post(route('admin.companies.billing.provision', $company), $this->provisionPayload())
            ->assertSessionHasErrors('api');

        $settings = $company->billingSettings()->first();
        $this->assertSame(BillingStatus::ProvisioningError, $settings->status);
        $this->assertStringContainsString('Contraseña del certificado incorrecta', $settings->last_error);
        $this->assertFalse($settings->hasCredentials());
    }

    public function test_connection_timeout_is_handled_without_retry(): void
    {
        $company = $this->companyWithSeries();

        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('timeout'));

        $this->actingAs($this->superAdmin)
            ->post(route('admin.companies.billing.provision', $company), $this->provisionPayload())
            ->assertSessionHasErrors('api');

        Http::assertSentCount(0); // la excepción se lanza antes de registrar el envío
        $this->assertSame('connection', ApiOperationLog::query()->withoutGlobalScopes()->value('error_type'));
    }

    public function test_profile_change_rolls_back_when_api_rejects(): void
    {
        $company = Company::factory()->provisioned()->create(['trade_name' => 'Original']);
        $admin = User::factory()->create();
        $admin->forceFill(['company_id' => $company->id])->save();
        $admin->assignRole(UserRole::CompanyAdmin->value);

        Http::fake(['api.test/api/v1/empresa' => Http::response(['estado' => 'error', 'mensaje' => 'Ubigeo inválido'], 422)]);

        $this->actingAs($admin)->put(route('company-settings.profile.update'), [
            'ruc' => $company->ruc,
            'legal_name' => $company->legal_name,
            'trade_name' => 'Nuevo nombre',
            'fiscal_address' => 'AV. NUEVA 1',
            'ubigeo' => '999999',
            'department' => 'LIMA', 'province' => 'LIMA', 'district' => 'LIMA',
            'tax_regime' => 'general',
        ])->assertSessionHasErrors('api');

        $this->assertSame('Original', $company->fresh()->trade_name);
    }

    public function test_ruc_cannot_change_after_provisioning(): void
    {
        $company = Company::factory()->provisioned()->create();
        $admin = User::factory()->create();
        $admin->forceFill(['company_id' => $company->id])->save();
        $admin->assignRole(UserRole::CompanyAdmin->value);

        $this->actingAs($admin)->put(route('company-settings.profile.update'), [
            'ruc' => '20100070970',
            'legal_name' => 'X',
            'fiscal_address' => 'X', 'ubigeo' => '150101', 'department' => 'L', 'province' => 'L', 'district' => 'L',
            'tax_regime' => 'general',
        ])->assertSessionHasErrors('ruc');
    }

    public function test_environment_change_requires_ruc_confirmation_and_is_synced(): void
    {
        $company = Company::factory()->provisioned()->create();
        Http::fake(['api.test/api/v1/empresa' => Http::response(['estado' => 'exito', 'datos' => []])]);

        $this->actingAs($this->superAdmin)
            ->put(route('admin.companies.billing.environment', $company), ['environment' => 'production', 'confirmation' => 'otro'])
            ->assertSessionHasErrors('confirmation');

        $this->actingAs($this->superAdmin)
            ->put(route('admin.companies.billing.environment', $company), ['environment' => 'production', 'confirmation' => $company->ruc])
            ->assertSessionHasNoErrors();

        $this->assertSame('production', $company->billingSettings()->first()->environment);
        Http::assertSent(fn (HttpRequest $r) => $r->method() === 'PUT' && $r['entorno'] === 'production');
    }

    public function test_certificate_upload_is_forwarded_and_not_stored(): void
    {
        $company = Company::factory()->provisioned()->create();
        Http::fake([
            'api.test/api/v1/empresa/certificado' => Http::response(['estado' => 'exito', 'datos' => []]),
            'api.test/api/v1/empresa' => Http::response(['estado' => 'exito', 'datos' => ['tasa_igv_vigente' => 18, 'certificado_vence' => '2027-10-01']]),
        ]);

        $this->actingAs($this->superAdmin)->post(route('admin.companies.billing.certificate', $company), [
            'certificate' => UploadedFile::fake()->createWithContent('nuevo.pfx', 'pfx'),
            'certificate_password' => 'clave',
        ])->assertSessionHasNoErrors();

        $settings = $company->billingSettings()->first();
        $this->assertNotNull($settings->certificate_uploaded_at);
        $this->assertSame('2027-10-01', $settings->certificate_valid_to->toDateString());
        $this->assertSame([], glob(storage_path('app/private/**/*.pfx')) ?: []);
    }

    public function test_plan_is_assigned_locally_before_provisioning(): void
    {
        $company = Company::factory()->create(['api_plan' => 'free']);

        $this->actingAs($this->superAdmin)->post(route('admin.companies.billing.plan', $company), [
            'plan' => 'business', 'cycle' => 'monthly', 'action' => 'change',
        ])->assertSessionHasNoErrors();

        $this->assertSame('business', $company->fresh()->api_plan);
    }
}
