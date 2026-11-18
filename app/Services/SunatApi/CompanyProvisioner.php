<?php

namespace App\Services\SunatApi;

use App\Enums\BillingStatus;
use App\Models\Company;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Registra (aprovisiona) un taller en la API SUNAT PRO con POST /registro y
 * luego sincroniza datos de empresa, sucursales y series.
 *
 * Las credenciales devueltas se guardan cifradas EN CUANTO llegan, en su
 * propia transacción, porque el secret no puede volver a consultarse.
 */
class CompanyProvisioner
{
    public function __construct(private readonly CompanyConfigSync $sync) {}

    /**
     * @param  array{sol_user: string, sol_pass: string, certificate_password: string, client_id?: string|null, client_secret?: string|null}  $credentials
     */
    public function register(Company $company, UploadedFile $certificate, array $credentials): void
    {
        $settings = $company->billingSettings;

        $fields = [
            'ruc' => $company->ruc,
            'razon_social' => $company->legal_name,
            'direccion' => $settings->fiscal_address,
            'ubigeo' => $settings->ubigeo,
            'departamento' => $settings->department,
            'provincia' => $settings->province,
            'distrito' => $settings->district,
            'sol_user' => $credentials['sol_user'],
            'sol_pass' => $credentials['sol_pass'],
            'contrasena_certificado' => $credentials['certificate_password'],
            'tax_regime' => $settings->tax_regime,
            'plan' => $company->api_plan,
            'entorno' => $settings->environment,
            'client_id' => $credentials['client_id'] ?? null,
            'client_secret' => $credentials['client_secret'] ?? null,
        ];

        try {
            $response = SunatApiClient::anonymous($company)->postMultipart('registro', $fields, ['certificado' => $certificate], 'provision');
        } catch (SunatApiException $e) {
            $settings->forceFill([
                'status' => BillingStatus::ProvisioningError,
                'last_error' => $e->userMessage(),
            ])->save();

            throw $e;
        }

        $apiKey = $response->find('api_key', 'x_api_key', 'key');
        $apiSecret = $response->find('api_secret', 'x_api_secret', 'secret');

        if (! is_string($apiKey) || ! is_string($apiSecret)) {
            $message = 'La API registró la solicitud pero no devolvió credenciales reconocibles. Use "Recuperar credenciales" para obtenerlas.';
            $settings->forceFill(['status' => BillingStatus::ProvisioningError, 'last_error' => $message])->save();

            throw new SunatApiException($message, $response->status, errorType: 'unexpected_response');
        }

        DB::transaction(function () use ($settings, $apiKey, $apiSecret): void {
            $settings->forceFill([
                'api_key' => $apiKey,
                'api_secret' => $apiSecret,
                'provisioned_at' => now(),
                'certificate_uploaded_at' => now(),
                'certificate_uploaded_by' => auth()->id(),
                'last_error' => null,
            ])->save();
        });

        $this->synchronize($company->fresh(['billingSettings']));
    }

    /**
     * Envía a la API la configuración local (empresa, sucursales, series) y
     * lee la tasa de IGV / certificado. Se puede reintentar sin riesgo: vincula
     * lo que ya existe en la API antes de crear.
     */
    public function synchronize(Company $company): void
    {
        $settings = $company->billingSettings;

        try {
            $this->sync->pushProfile($company);
            $this->sync->syncEstablishments($company);
            $this->sync->syncSeries($company);
            $this->sync->refreshFromApi($company);

            $settings->forceFill([
                'status' => BillingStatus::Ready,
                'last_error' => null,
                'last_validated_at' => now(),
            ])->save();
        } catch (SunatApiException $e) {
            $settings->forceFill([
                'status' => BillingStatus::ProvisioningError,
                'last_error' => 'Registrado en la API, pero falló la sincronización: '.$e->userMessage(),
            ])->save();

            throw $e;
        }
    }
}
