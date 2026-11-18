<?php

namespace Tests\Feature\Companies;

use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\DetractionType;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Un taller nunca puede ver ni modificar datos de otro.
 */
class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Company $companyA;

    private Company $companyB;

    private User $adminA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyA = Company::factory()->create();
        $this->companyB = Company::factory()->create();
        $this->adminA = $this->companyAdmin($this->companyA);
    }

    private function companyAdmin(Company $company): User
    {
        $user = User::factory()->create();
        $user->forceFill(['company_id' => $company->id])->save();
        $user->assignRole(UserRole::CompanyAdmin->value);

        return $user;
    }

    private function establishmentOf(Company $company): Establishment
    {
        return Establishment::query()->withoutGlobalScopes()->where('company_id', $company->id)->firstOrFail();
    }

    public function test_establishments_list_only_shows_own_company(): void
    {
        $this->actingAs($this->adminA)
            ->get(route('company-settings.establishments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('establishments', 1));
    }

    public function test_cannot_update_or_delete_another_company_establishment(): void
    {
        $foreign = $this->establishmentOf($this->companyB);

        $this->actingAs($this->adminA)->put(route('company-settings.establishments.update', $foreign), [
            'name' => 'Hackeado', 'local_code' => '0005', 'address' => 'X', 'ubigeo' => '150101',
        ])->assertNotFound();

        $this->actingAs($this->adminA)->delete(route('company-settings.establishments.destroy', $foreign))->assertNotFound();

        $this->assertSame('Principal', $foreign->fresh()->name);
    }

    public function test_cannot_toggle_another_company_series(): void
    {
        $series = new DocumentSeries([
            'establishment_id' => $this->establishmentOf($this->companyB)->id,
            'document_type' => DocumentType::Invoice,
            'series' => 'F001',
            'is_active' => true,
        ]);
        $series->company_id = $this->companyB->id;
        $series->save();

        $this->actingAs($this->adminA)
            ->patch(route('company-settings.series.update', $series), ['is_active' => false])
            ->assertNotFound();

        $this->assertTrue($series->fresh()->is_active);
    }

    public function test_cannot_create_series_in_another_company_establishment(): void
    {
        $this->actingAs($this->adminA)->post(route('company-settings.series.store'), [
            'document_type' => '01',
            'series' => 'F002',
            'establishment_id' => $this->establishmentOf($this->companyB)->id,
        ])->assertSessionHasErrors('establishment_id');
    }

    public function test_cannot_edit_another_company_detraction_type(): void
    {
        $type = new DetractionType(['code' => '020', 'description' => 'Mant.', 'rate' => 12, 'is_active' => true]);
        $type->company_id = $this->companyB->id;
        $type->save();

        $this->actingAs($this->adminA)->put(route('company-settings.detraction.types.update', $type), [
            'code' => '020', 'description' => 'X', 'rate' => 1,
        ])->assertNotFound();

        $this->assertSame('12.00', $type->fresh()->rate);
    }

    public function test_cannot_see_or_edit_another_company_users(): void
    {
        $adminB = $this->companyAdmin($this->companyB);

        $this->actingAs($this->adminA)
            ->get(route('company-settings.users.index'))
            ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.id', $this->adminA->id));

        $this->actingAs($this->adminA)->put(route('company-settings.users.update', $adminB), [
            'first_name' => 'X', 'last_name' => 'Y', 'email' => 'x@y.pe', 'role' => 'mechanic',
        ])->assertNotFound();

        $this->actingAs($this->adminA)->patch(route('company-settings.users.toggle', $adminB))->assertNotFound();

        $this->assertTrue($adminB->fresh()->is_active);
    }

    public function test_activity_log_is_filtered_by_company(): void
    {
        ActivityLog::query()->create(['company_id' => $this->companyA->id, 'action' => 'a', 'description' => 'De A']);
        ActivityLog::query()->create(['company_id' => $this->companyB->id, 'action' => 'b', 'description' => 'De B']);

        $this->actingAs($this->adminA)
            ->get(route('activity-logs.index'))
            ->assertInertia(fn (Assert $page) => $page->has('logs.data', 1)->where('logs.data.0.description', 'De A'));
    }

    public function test_mechanic_cannot_manage_settings_or_users(): void
    {
        $mechanic = User::factory()->create();
        $mechanic->forceFill(['company_id' => $this->companyA->id])->save();
        $mechanic->assignRole(UserRole::Mechanic->value);

        $this->actingAs($mechanic)->get(route('company-settings.profile.edit'))->assertForbidden();
        $this->actingAs($mechanic)->get(route('company-settings.users.index'))->assertForbidden();
    }
}
