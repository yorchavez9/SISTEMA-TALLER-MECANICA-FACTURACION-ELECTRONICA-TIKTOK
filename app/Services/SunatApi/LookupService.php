<?php

namespace App\Services\SunatApi;

use App\Models\Company;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Support\Facades\Cache;

/**
 * Catálogo de ubigeo y búsqueda RUC/DNI a través de la API.
 * Si no hay credenciales disponibles, devuelve null (la UI permite ingreso manual).
 */
class LookupService
{
    public function available(?Company $company): bool
    {
        return SunatApiClient::forLookups($company) !== null;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    public function regions(?Company $company): ?array
    {
        return $this->cachedList($company, 'ubigeo.regions', 'catalogos/ubigeo/regiones', []);
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    public function provinces(?Company $company, string $regionId): ?array
    {
        return $this->cachedList($company, 'ubigeo.provinces.'.$regionId, 'catalogos/ubigeo/provincias', ['region_id' => $regionId]);
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    public function districts(?Company $company, string $provinceId): ?array
    {
        return $this->cachedList($company, 'ubigeo.districts.'.$provinceId, 'catalogos/ubigeo/distritos', ['provincia_id' => $provinceId]);
    }

    /**
     * Busca un RUC o DNI (GET /buscar-documento). Resultados en caché 30 días.
     *
     * @return array<string, mixed>|null
     */
    public function document(?Company $company, string $type, string $number): ?array
    {
        $client = SunatApiClient::forLookups($company);

        if ($client === null) {
            return null;
        }

        return Cache::remember("sunat_api.document.{$type}.{$number}", now()->addDays(30), function () use ($client, $type, $number): ?array {
            try {
                return $client->get('buscar-documento', ['tipo' => $type, 'numero' => $number], 'lookup_document')->datos;
            } catch (SunatApiException) {
                return null;
            }
        }) ?: null;
    }

    /**
     * @param  array<string, string>  $query
     * @return list<array<string, mixed>>|null
     */
    private function cachedList(?Company $company, string $key, string $path, array $query): ?array
    {
        $client = SunatApiClient::forLookups($company);

        if ($client === null) {
            return null;
        }

        try {
            return Cache::remember('sunat_api.'.$key, now()->addDays(30), function () use ($client, $path, $query): array {
                $datos = $client->get($path, $query, 'catalog_ubigeo')->datos ?? [];

                return array_is_list($datos) ? $datos : ($datos['data'] ?? []);
            });
        } catch (SunatApiException) {
            return null;
        }
    }
}
