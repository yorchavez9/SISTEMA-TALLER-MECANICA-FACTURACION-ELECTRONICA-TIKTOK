<?php

namespace App\Services\SunatApi;

use App\Models\Company;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Support\Facades\Cache;

/**
 * Planes y suscripción del taller en la API (solo super admin).
 */
class SubscriptionManager
{
    /**
     * Planes disponibles (GET /planes, público). Se cachean 1 hora.
     *
     * @return list<array{slug: string, nombre: string, precio_mensual: string|null, precio_anual: string|null, limites: array<string, int>}>
     */
    public function plans(): array
    {
        try {
            return Cache::remember('sunat_api.plans', now()->addHour(), function (): array {
                $datos = SunatApiClient::anonymous()->get('planes', operation: 'list_plans')->datos ?? [];

                return collect($datos)
                    ->filter(fn ($p) => is_array($p) && isset($p['slug']))
                    ->map(fn (array $p) => [
                        'slug' => (string) $p['slug'],
                        'nombre' => (string) ($p['nombre'] ?? $p['slug']),
                        'precio_mensual' => isset($p['precio_mensual']) ? (string) $p['precio_mensual'] : null,
                        'precio_anual' => isset($p['precio_anual']) ? (string) $p['precio_anual'] : null,
                        'limites' => is_array($p['limites'] ?? null) ? $p['limites'] : [],
                    ])
                    ->values()
                    ->all();
            });
        } catch (SunatApiException) {
            return [];
        }
    }

    /**
     * Resumen para la ficha del taller. Cada bloque es null si la API falla.
     *
     * @return array{subscription: array<string, mixed>|null, usage: array<string, mixed>|null, payments: list<mixed>|null, error: string|null}
     */
    public function overview(Company $company): array
    {
        $result = ['subscription' => null, 'usage' => null, 'payments' => null, 'error' => null];

        try {
            $client = SunatApiClient::forCompany($company);
            $result['subscription'] = $client->get('suscripcion', operation: 'get_subscription')->datos;
            $result['usage'] = $client->get('suscripcion/uso', operation: 'get_usage')->datos;
            $result['payments'] = $client->get('suscripcion/pagos', operation: 'get_payments')->datos;
        } catch (SunatApiException $e) {
            $result['error'] = $e->userMessage();
        }

        return $result;
    }

    public function activate(Company $company, string $plan, string $cycle, bool $trial): void
    {
        SunatApiClient::forCompany($company)->post('suscripcion', [
            'plan_slug' => $plan,
            'ciclo_facturacion' => $cycle,
            'prueba' => $trial,
        ], 'activate_subscription');

        $company->forceFill(['api_plan' => $plan])->save();
    }

    public function changePlan(Company $company, string $plan, string $cycle): void
    {
        SunatApiClient::forCompany($company)->put('suscripcion/cambiar-plan', [
            'plan_slug' => $plan,
            'ciclo_facturacion' => $cycle,
        ], 'change_plan');

        $company->forceFill(['api_plan' => $plan])->save();
    }

    public function cancel(Company $company): void
    {
        SunatApiClient::forCompany($company)->put('suscripcion/cancelar', [], 'cancel_subscription');
    }
}
