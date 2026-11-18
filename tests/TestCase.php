<?php

namespace Tests;

use App\Models\SystemSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /**
     * Por defecto las pruebas parten de un sistema ya instalado (sin el
     * Setup Wizard). Las pruebas del wizard lo ponen en false.
     */
    protected bool $systemInstalled = true;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();

        if ($this->systemInstalled && in_array(RefreshDatabase::class, class_uses_recursive(static::class), true)) {
            $this->markSystemAsInstalled();
        }
    }

    protected function markSystemAsInstalled(): void
    {
        SystemSetting::query()->whereKey(SystemSetting::SINGLETON_ID)->update(['installed_at' => now()]);
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
