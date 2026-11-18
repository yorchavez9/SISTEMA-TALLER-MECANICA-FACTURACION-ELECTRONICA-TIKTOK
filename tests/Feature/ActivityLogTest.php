<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_see_the_activity_log(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(UserRole::SuperAdmin->value);

        ActivityLog::query()->create(['action' => 'demo.one', 'description' => 'Primera operación']);
        ActivityLog::query()->create(['action' => 'demo.two', 'description' => 'Segunda operación']);

        $this->actingAs($admin)
            ->get(route('activity-logs.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('activity-logs/index')
                ->has('logs.data', 2)
                ->where('logs.total', 2));
    }

    public function test_activity_log_can_be_searched(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole(UserRole::SuperAdmin->value);

        ActivityLog::query()->create(['action' => 'demo.one', 'description' => 'Cambio de tema']);
        ActivityLog::query()->create(['action' => 'demo.two', 'description' => 'Otra cosa']);

        $this->actingAs($admin)
            ->get(route('activity-logs.index', ['search' => 'tema']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('filters.search', 'tema'));
    }

    public function test_users_without_permission_cannot_see_the_activity_log(): void
    {
        $mechanic = User::factory()->create();
        $mechanic->assignRole(UserRole::Mechanic->value);

        $this->actingAs($mechanic)->get(route('activity-logs.index'))->assertForbidden();
    }
}
