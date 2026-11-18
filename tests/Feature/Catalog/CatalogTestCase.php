<?php

namespace Tests\Feature\Catalog;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class CatalogTestCase extends TestCase
{
    use RefreshDatabase;

    protected Company $company;

    protected Company $otherCompany;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->otherCompany = Company::factory()->create();
        $this->admin = $this->userWithRole(UserRole::CompanyAdmin, $this->company);
    }

    protected function userWithRole(UserRole $role, Company $company): User
    {
        $user = User::factory()->create();
        $user->forceFill(['company_id' => $company->id])->save();
        $user->assignRole($role->value);

        return $user;
    }

    /**
     * Crea un modelo del catálogo en una empresa concreta (sin depender de la empresa actual).
     *
     * @template T of \Illuminate\Database\Eloquent\Model
     *
     * @param  \Illuminate\Database\Eloquent\Factories\Factory<T>  $factory
     * @param  array<string, mixed>  $attributes
     * @return T
     */
    protected function makeFor(Company $company, $factory, array $attributes = [])
    {
        $model = $factory->make($attributes);
        $model->company_id = $company->id;
        $model->save();

        return $model;
    }
}
