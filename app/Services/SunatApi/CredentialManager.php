<?php

namespace App\Services\SunatApi;

use App\Enums\BillingStatus;
use App\Models\Company;
use App\Services\SunatApi\Exceptions\SunatApiException;

/**
 * Prueba de conexión, rotación y recuperación de las credenciales del taller
 * en la API. Los valores de las credenciales nunca se devuelven al navegador.
 */
class CredentialManager
{
    public function __construct(private readonly CompanyConfigSync $sync) {}

    /**
     * @return list<array{name: string, ok: bool, detail: string}>
     */
    public function testConnection(Company $company): array
    {
        $checks = [];

        try {
            $health = SunatApiClient::anonymous($company)->health();
            $checks[] = ['name' => 'API de facturación', 'ok' => ($health->raw['estado'] ?? null) === 'ok', 'detail' => 'Estado: '.($health->raw['estado'] ?? 'desconocido')];
        } catch (SunatApiException $e) {
            $checks[] = ['name' => 'API de facturación', 'ok' => false, 'detail' => $e->userMessage()];
        }

        try {
            $this->sync->refreshFromApi($company);
            $checks[] = ['name' => 'Credenciales del taller', 'ok' => true, 'detail' => 'Autenticación correcta (GET /empresa).'];
        } catch (SunatApiException $e) {
            $checks[] = ['name' => 'Credenciales del taller', 'ok' => false, 'detail' => $e->userMessage()];
        }

        try {
            $sunat = SunatApiClient::forCompany($company)->get('sunat/estado', operation: 'sunat_status');
            $available = $sunat->find('disponible');
            $checks[] = [
                'name' => 'Servicio de SUNAT',
                'ok' => $available !== false,
                'detail' => $available === false ? 'SUNAT no disponible en este momento (circuito: '.($sunat->find('circuit') ?? '?').').' : 'Disponible ('.($sunat->find('entorno') ?? 'entorno desconocido').').',
            ];
        } catch (SunatApiException $e) {
            $checks[] = ['name' => 'Servicio de SUNAT', 'ok' => false, 'detail' => $e->userMessage()];
        }

        // Solo se registra la fecha. Un aprovisionamiento a medias no se marca
        // como listo aquí: debe completarse con "Reintentar sincronización".
        $company->billingSettings->forceFill(['last_validated_at' => now()])->save();

        return $checks;
    }

    /**
     * Genera un nuevo par de credenciales en la API y lo guarda cifrado.
     */
    public function regenerate(Company $company): void
    {
        $response = SunatApiClient::forCompany($company)->post('empresa/credenciales/regenerar', [], 'regenerate_credentials');
        $this->store($company, $response);
    }

    /**
     * Solicita a la API el envío del token de recuperación al correo registrado.
     */
    public function requestRecovery(Company $company): void
    {
        SunatApiClient::anonymous($company)->post('credenciales/recuperar', ['ruc' => $company->ruc], 'recover_credentials_request');
    }

    /**
     * Canjea el token recibido por correo por un nuevo par de credenciales.
     */
    public function verifyRecovery(Company $company, string $token): void
    {
        $response = SunatApiClient::anonymous($company)->post('credenciales/recuperar/verificar', ['token' => $token], 'recover_credentials_verify');
        $this->store($company, $response);
    }

    private function store(Company $company, ApiResponse $response): void
    {
        $apiKey = $response->find('api_key', 'x_api_key', 'key');
        $apiSecret = $response->find('api_secret', 'x_api_secret', 'secret');

        if (! is_string($apiKey) || ! is_string($apiSecret)) {
            throw new SunatApiException('La API no devolvió credenciales reconocibles.', $response->status, errorType: 'unexpected_response');
        }

        $company->billingSettings->forceFill([
            'api_key' => $apiKey,
            'api_secret' => $apiSecret,
            'provisioned_at' => $company->billingSettings->provisioned_at ?? now(),
            'last_error' => null,
        ])->save();
    }

    /**
     * Elimina el taller (tenant) en la API. Irreversible en la API; localmente
     * se borran las credenciales y los vínculos con sucursales/series.
     */
    public function deleteTenant(Company $company): void
    {
        SunatApiClient::forCompany($company)->delete('empresa', 'delete_tenant');

        $company->billingSettings->forceFill([
            'api_key' => null,
            'api_secret' => null,
            'status' => BillingStatus::NotConfigured,
            'provisioned_at' => null,
            'certificate_uploaded_at' => null,
            'certificate_valid_to' => null,
        ])->save();

        $company->establishments()->withoutGlobalScopes()->update(['api_branch_id' => null]);
        $company->documentSeries()->withoutGlobalScopes()->update(['api_series_id' => null]);
    }
}
