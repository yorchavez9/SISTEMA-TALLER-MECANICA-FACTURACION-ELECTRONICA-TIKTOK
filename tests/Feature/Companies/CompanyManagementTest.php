<?php

namespace Tests\Feature\Companies;

use App\Enums\BillingStatus;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\DetractionType;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Models\User;
use Database\Factories\CompanyFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CompanyManagementTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(): User
    {
        $user = User::factory()->create();
        $user->assignRole(UserRole::SuperAdmin->value);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'ruc' => CompanyFactory::validRuc(),
            'legal_name' => 'Taller Los Andes S.A.C.',
            'trade_name' => 'Los Andes',
            'email' => 'contacto@losandes.pe',
            'phone' => '999 111 222',
            'fiscal_address' => 'Av. Industrial 456',
            'ubigeo' => '150101',
            'department' => 'Lima',
            'province' => 'Lima',
            'district' => 'Lima',
            'tax_regime' => 'general',
            'api_plan' => 'pro',
            'environment' => 'beta',
            'admin_first_name' => 'Rosa',
            'admin_last_name' => 'Huamán',
            'admin_email' => 'rosa@losandes.pe',
            'admin_password' => 'Taller#2026seguro',
            'admin_password_confirmation' => 'Taller#2026seguro',
        ], $overrides);
    }

    public function test_super_admin_creates_a_company_with_initial_configuration(): void
    {
        Http::fake(['*/planes' => Http::response(['estado' => 'exito', 'datos' => []])]);

        $this->actingAs($this->superAdmin())
            ->post(route('admin.companies.store'), $this->payload())
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $company = Company::query()->sole();
        $this->assertSame('TALLER LOS ANDES S.A.C.', $company->legal_name);
        $this->assertSame('pro', $company->api_plan);
        $this->assertSame(BillingStatus::NotConfigured, $company->billingSettings->status);
        $this->assertSame('beta', $company->billingSettings->environment);
        $this->assertSame('AV. INDUSTRIAL 456', $company->billingSettings->fiscal_address);

        $main = Establishment::query()->withoutGlobalScopes()->where('company_id', $company->id)->sole();
        $this->assertSame('0000', $main->local_code);
        $this->assertTrue($main->is_main);

        $series = DocumentSeries::query()->withoutGlobalScopes()->where('company_id', $company->id)->pluck('series')->sort()->values()->all();
        $this->assertSame(['B001', 'BC01', 'BD01', 'F001', 'FC01', 'FD01'], $series);

        $this->assertSame(4, DetractionType::query()->withoutGlobalScopes()->where('company_id', $company->id)->count());

        $admin = User::query()->where('email', 'rosa@losandes.pe')->sole();
        $this->assertSame($company->id, $admin->company_id);
        $this->assertTrue($admin->hasRole(UserRole::CompanyAdmin->value));
    }

    public function test_ruc_must_be_valid_and_unique(): void
    {
        $admin = $this->superAdmin();
        $existing = Company::factory()->create();

        $this->actingAs($admin)
            ->post(route('admin.companies.store'), $this->payload(['ruc' => '20123456789']))
            ->assertSessionHasErrors('ruc');

        $this->actingAs($admin)
            ->post(route('admin.companies.store'), $this->payload(['ruc' => $existing->ruc]))
            ->assertSessionHasErrors('ruc');
    }

    public function test_company_users_cannot_access_the_admin_area(): void
    {
        $company = Company::factory()->create();
        $companyAdmin = User::factory()->create(['company_id' => null]);
        $companyAdmin->forceFill(['company_id' => $company->id])->save();
        $companyAdmin->assignRole(UserRole::CompanyAdmin->value);

        $this->actingAs($companyAdmin)->get(route('admin.companies.index'))->assertForbidden();
        $this->actingAs($companyAdmin)->post(route('admin.companies.store'), $this->payload())->assertForbidden();
        $this->actingAs($companyAdmin)->put(route('admin.companies.billing.environment', $company), [
            'environment' => 'production', 'confirmation' => $company->ruc,
        ])->assertForbidden();
        $this->actingAs($companyAdmin)->post(route('admin.companies.billing.plan', $company), [
            'plan' => 'business', 'cycle' => 'monthly', 'action' => 'change',
        ])->assertForbidden();
    }

    public function test_super_admin_can_list_and_view_companies(): void
    {
        $company = Company::factory()->create();
        Http::fake(['*/planes' => Http::response(['estado' => 'exito', 'datos' => []])]);

        $this->actingAs($this->superAdmin())
            ->get(route('admin.companies.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/companies/index')->has('companies.data', 1));

        $this->actingAs($this->superAdmin())
            ->get(route('admin.companies.show', $company))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/companies/show')
                ->where('company.ruc', $company->ruc)
                ->where('billing.connected', false)
                ->missing('billing.api_key')
                ->missing('billing.api_secret'));
    }

    public function test_suspended_company_users_are_logged_out(): void
    {
        $company = Company::factory()->create(['status' => Company::STATUS_SUSPENDED]);
        $user = User::factory()->create();
        $user->forceFill(['company_id' => $company->id])->save();
        $user->assignRole(UserRole::CompanyAdmin->value);

        $this->actingAs($user)->get(route('company-settings.profile.edit'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_super_admin_must_enter_a_company_to_use_company_settings(): void
    {
        $admin = $this->superAdmin();
        $company = Company::factory()->create();

        $this->actingAs($admin)->get(route('company-settings.profile.edit'))->assertRedirect(route('admin.companies.index'));

        $this->actingAs($admin)->post(route('admin.companies.enter', $company))->assertRedirect(route('company-settings.profile.edit'));

        $this->actingAs($admin)->get(route('company-settings.profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.ruc', $company->ruc)
                ->where('company.acting_as_admin', true));
    }
}
