<?php

namespace Tests\Feature\Setup;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\Setup\InstallationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class SetupWizardTest extends TestCase
{
    use RefreshDatabase;

    protected bool $systemInstalled = false;

    private const VALID_PASSWORD = 'Taller#2026seguro';

    /**
     * @return array<string, string>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Ana María',
            'last_name' => 'Quispe Rojas',
            'email' => 'Admin@Taller.pe',
            'password' => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ], $overrides);
    }

    public function test_any_page_redirects_to_setup_when_not_installed(): void
    {
        $this->get('/dashboard')->assertRedirect(route('setup.show'));
        $this->get(route('login'))->assertRedirect(route('setup.show'));
        $this->get('/')->assertRedirect(route('setup.show'));
    }

    public function test_setup_screen_is_rendered_when_not_installed(): void
    {
        $this->get(route('setup.show'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('setup/welcome')->has('passwordRules'));
    }

    public function test_first_super_admin_is_created_logged_in_and_redirected(): void
    {
        $response = $this->post(route('setup.store'), $this->validPayload());

        $response->assertSessionHasNoErrors()->assertRedirect(route('dashboard'));

        $user = User::query()->sole();
        $this->assertSame('Ana María', $user->first_name);
        $this->assertSame('Quispe Rojas', $user->last_name);
        $this->assertSame('admin@taller.pe', $user->email);
        $this->assertTrue($user->hasRole(UserRole::SuperAdmin->value));
        $this->assertNotSame(self::VALID_PASSWORD, $user->password);
        $this->assertTrue(password_verify(self::VALID_PASSWORD, $user->password));
        $this->assertAuthenticatedAs($user);

        $settings = SystemSetting::query()->findOrFail(SystemSetting::SINGLETON_ID);
        $this->assertNotNull($settings->installed_at);
        $this->assertSame($user->id, $settings->installed_by_user_id);

        $this->assertTrue(ActivityLog::query()->where('action', 'setup.completed')->exists());
    }

    public function test_role_cannot_be_chosen_from_the_request(): void
    {
        $this->post(route('setup.store'), $this->validPayload([
            'role' => 'mechanic',
            'roles' => ['mechanic'],
            'is_active' => '0',
        ]))->assertSessionHasNoErrors();

        $user = User::query()->sole();
        $this->assertSame([UserRole::SuperAdmin->value], $user->getRoleNames()->all());
        $this->assertTrue($user->is_active);
    }

    public function test_required_fields_are_validated(): void
    {
        $this->from(route('setup.show'))
            ->post(route('setup.store'), [])
            ->assertSessionHasErrors(['first_name', 'last_name', 'email', 'password']);

        $this->assertSame(0, User::query()->count());
    }

    public function test_weak_password_is_rejected(): void
    {
        foreach (['corta1!', 'sinmayusculas#2026', 'SinNumeros#abc', 'SinSimbolos2026x'] as $weak) {
            $this->from(route('setup.show'))
                ->post(route('setup.store'), $this->validPayload([
                    'password' => $weak,
                    'password_confirmation' => $weak,
                ]))
                ->assertSessionHasErrors('password');
        }

        $this->assertSame(0, User::query()->count());
    }

    public function test_password_confirmation_must_match(): void
    {
        $this->from(route('setup.show'))
            ->post(route('setup.store'), $this->validPayload(['password_confirmation' => 'Otra#Clave2026']))
            ->assertSessionHasErrors('password');
    }

    public function test_invalid_email_is_rejected(): void
    {
        $this->from(route('setup.show'))
            ->post(route('setup.store'), $this->validPayload(['email' => 'no-es-un-correo']))
            ->assertSessionHasErrors('email');
    }

    public function test_setup_is_blocked_after_installation(): void
    {
        $this->post(route('setup.store'), $this->validPayload())->assertRedirect(route('dashboard'));
        $this->post(route('logout'));

        $this->get(route('setup.show'))->assertNotFound();
        $this->post(route('setup.store'), $this->validPayload(['email' => 'otro@taller.pe']))->assertNotFound();

        $this->assertSame(1, User::query()->count());
    }

    public function test_after_installation_guests_see_the_login(): void
    {
        $this->post(route('setup.store'), $this->validPayload());
        $this->post(route('logout'));

        $this->get('/dashboard')->assertRedirect(route('login'));
        $this->get(route('login'))->assertOk();
    }

    public function test_setup_is_blocked_when_a_super_admin_already_exists(): void
    {
        // Instalación con installed_at vacío pero ya con un super admin (p. ej. creado por consola).
        $admin = User::factory()->create();
        $admin->assignRole(UserRole::SuperAdmin->value);

        $this->get(route('setup.show'))->assertNotFound();
        $this->post(route('setup.store'), $this->validPayload())->assertNotFound();
    }

    public function test_service_refuses_a_second_super_admin_even_if_middleware_is_bypassed(): void
    {
        $service = app(InstallationService::class);

        $service->createSuperAdmin([
            'first_name' => 'Uno',
            'last_name' => 'Admin',
            'email' => 'uno@taller.pe',
            'password' => self::VALID_PASSWORD,
        ]);

        $this->expectException(NotFoundHttpException::class);

        $service->createSuperAdmin([
            'first_name' => 'Dos',
            'last_name' => 'Admin',
            'email' => 'dos@taller.pe',
            'password' => self::VALID_PASSWORD,
        ]);
    }

    public function test_fresh_database_shows_the_wizard_again(): void
    {
        // Equivale a reinstalar con una base nueva: fila sin installed_at y sin usuarios.
        $this->assertFalse(app(InstallationService::class)->isInstalled());
        $this->get('/dashboard')->assertRedirect(route('setup.show'));
    }
}
