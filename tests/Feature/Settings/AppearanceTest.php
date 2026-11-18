<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AppearanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_theme_preference_is_saved_per_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->from(route('appearance.edit'))
            ->patch(route('appearance.update'), ['theme' => 'dark'])
            ->assertRedirect(route('appearance.edit'))
            ->assertCookie('appearance', 'dark', false);

        $this->assertSame('dark', $user->fresh()->theme);
    }

    public function test_invalid_theme_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patch(route('appearance.update'), ['theme' => 'rojo'])
            ->assertSessionHasErrors('theme');

        $this->assertSame('system', $user->fresh()->theme);
    }

    public function test_saved_theme_is_rendered_by_the_server_and_shared_with_the_frontend(): void
    {
        $user = User::factory()->create(['theme' => 'dark']);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertSee('class="dark"', false)
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.theme', 'dark'));
    }

    public function test_shared_user_props_do_not_leak_sensitive_fields(): void
    {
        $user = User::factory()->withTwoFactor()->create();

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->missing('auth.user.password')
                ->missing('auth.user.two_factor_secret')
                ->missing('auth.user.two_factor_recovery_codes')
                ->missing('auth.user.remember_token'));
    }
}
