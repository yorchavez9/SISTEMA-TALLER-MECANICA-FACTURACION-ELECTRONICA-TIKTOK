<?php

namespace App\Services\Companies;

use App\Enums\BillingStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\DetractionType;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Alta local de un taller con su configuración inicial: datos fiscales,
 * establecimiento principal (0000), series sugeridas, tipos de detracción y su
 * usuario administrador. El registro en la API se hace después (aprovisionar).
 */
class CompanyRegistrar
{
    /**
     * Series sugeridas: F001/B001 y sus notas de crédito/débito.
     *
     * @var array<string, string>
     */
    private const DEFAULT_SERIES = [
        'F001' => '01',
        'B001' => '03',
        'FC01' => '07',
        'BC01' => '07',
        'FD01' => '08',
        'BD01' => '08',
    ];

    /**
     * @param  array<string, mixed>  $data  Datos validados por StoreCompanyRequest.
     */
    public function create(array $data): Company
    {
        return DB::transaction(function () use ($data): Company {
            $company = Company::query()->create([
                'ruc' => $data['ruc'],
                'legal_name' => $data['legal_name'],
                'trade_name' => $data['trade_name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'status' => Company::STATUS_ACTIVE,
                'api_plan' => $data['api_plan'],
            ]);

            $settings = $company->billingSettings()->make([
                'fiscal_address' => $data['fiscal_address'],
                'ubigeo' => $data['ubigeo'],
                'department' => $data['department'],
                'province' => $data['province'],
                'district' => $data['district'],
                'tax_regime' => $data['tax_regime'],
                'nrus_category' => $data['nrus_category'] ?? null,
            ]);
            $settings->forceFill([
                'environment' => $data['environment'],
                'status' => BillingStatus::NotConfigured,
            ])->save();

            $main = new Establishment([
                'name' => 'Principal',
                'local_code' => '0000',
                'address' => $data['fiscal_address'],
                'ubigeo' => $data['ubigeo'],
                'is_main' => true,
            ]);
            $main->company_id = $company->id;
            $main->save();

            foreach (self::DEFAULT_SERIES as $series => $type) {
                $documentSeries = new DocumentSeries([
                    'establishment_id' => $main->id,
                    'document_type' => DocumentType::from($type),
                    'series' => $series,
                    'initial_number' => 0,
                    'is_active' => true,
                ]);
                $documentSeries->company_id = $company->id;
                $documentSeries->save();
            }

            foreach (DetractionType::INITIAL as $type) {
                $detraction = new DetractionType($type);
                $detraction->company_id = $company->id;
                $detraction->save();
            }

            $admin = new User([
                'first_name' => $data['admin_first_name'],
                'last_name' => $data['admin_last_name'],
                'email' => $data['admin_email'],
                'password' => $data['admin_password'],
            ]);
            $admin->company_id = $company->id;
            $admin->is_active = true;
            $admin->email_verified_at = now();
            $admin->save();
            $admin->assignRole(UserRole::CompanyAdmin->value);

            return $company;
        });
    }
}
