<?php

namespace Database\Factories;

use App\Enums\BillingStatus;
use App\Models\Company;
use App\Models\Establishment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'ruc' => self::validRuc(),
            'legal_name' => mb_strtoupper(fake()->company()).' S.A.C.',
            'trade_name' => 'Taller '.fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '999888777',
            'status' => Company::STATUS_ACTIVE,
            'api_plan' => 'free',
        ];
    }

    /**
     * Crea también la configuración fiscal y el establecimiento principal.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (Company $company): void {
            $settings = $company->billingSettings()->make([
                'fiscal_address' => 'AV. PRINCIPAL 123',
                'ubigeo' => '150101',
                'department' => 'LIMA',
                'province' => 'LIMA',
                'district' => 'LIMA',
                'tax_regime' => 'general',
            ]);
            $settings->forceFill(['environment' => 'beta', 'status' => BillingStatus::NotConfigured])->save();

            $main = new Establishment([
                'name' => 'Principal',
                'local_code' => '0000',
                'address' => 'AV. PRINCIPAL 123',
                'ubigeo' => '150101',
                'is_main' => true,
            ]);
            $main->company_id = $company->id;
            $main->save();
        });
    }

    /**
     * Taller ya registrado en la API (credenciales de prueba).
     */
    public function provisioned(): static
    {
        return $this->afterCreating(function (Company $company): void {
            $company->billingSettings->forceFill([
                'api_key' => 'test-key-'.$company->id,
                'api_secret' => 'test-secret-'.$company->id,
                'status' => BillingStatus::Ready,
                'provisioned_at' => now(),
            ])->save();
        });
    }

    /**
     * Genera un RUC 20xxxxxxxxx con dígito verificador válido.
     */
    public static function validRuc(): string
    {
        $base = '20'.str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
        $sum = 0;

        foreach ($weights as $i => $w) {
            $sum += (int) $base[$i] * $w;
        }

        $check = 11 - ($sum % 11);
        $check = $check === 10 ? 0 : ($check === 11 ? 1 : $check);

        return $base.$check;
    }
}
