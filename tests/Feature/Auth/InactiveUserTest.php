<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InactiveUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_inactive_users_cannot_log_in(): void
    {
        $user = User::factory()->create(['email' => 'inactivo@taller.pe']);
        $user->forceFill(['is_active' => false])->save();

        $this->post(route('login.store'), [
            'email' => 'inactivo@taller.pe',
            'password' => 'password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_an_active_session_is_closed_when_the_user_is_deactivated(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $user->forceFill(['is_active' => false])->save();

        $this->get(route('dashboard'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_public_registration_is_disabled(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'X',
            'email' => 'x@x.pe',
            'password' => 'Taller#2026seguro',
            'password_confirmation' => 'Taller#2026seguro',
        ])->assertNotFound();

        $this->assertSame(0, User::query()->count());
    }

    public function test_last_login_is_recorded(): void
    {
        $user = User::factory()->create();

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

        $this->assertNotNull($user->fresh()->last_login_at);
    }
}
