<?php

namespace App\Services\SunatApi;

use App\Models\Company;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;

/**
 * Sincroniza con la API la configuración del taller: datos de empresa,
 * régimen, entorno, logo, certificado, sucursales y series.
 *
 * Si el taller todavía no está registrado en la API, los métodos no hacen
 * nada (la configuración local se enviará al aprovisionar).
 */
class CompanyConfigSync
{
    public function isConnected(Company $company): bool
    {
        return $company->billingSettings?->hasCredentials() ?? false;
    }

    /**
     * Datos de empresa, contacto y régimen (PUT /empresa).
     */
    public function pushProfile(Company $company): void
    {
        if (! $this->isConnected($company)) {
            return;
        }

        $s = $company->billingSettings;

        $payload = array_filter([
            'ruc' => $company->ruc,
            'razon_social' => $company->legal_name,
            'nombre_comercial' => $company->trade_name,
            'direccion' => $s->fiscal_address,
            'ubigeo' => $s->ubigeo,
            'departamento' => $s->department,
            'provincia' => $s->province,
            'distrito' => $s->district,
            'telefonos' => $company->phone ? [$company->phone] : null,
            'emails' => $company->email ? [$company->email] : null,
            'mensaje_agradecimiento' => $s->thanks_message,
            'tax_regime' => $s->tax_regime,
            'nrus_categoria' => $s->tax_regime === 'rus' ? $s->nrus_category : null,
        ], fn ($v) => $v !== null && $v !== '');

        SunatApiClient::forCompany($company)->put('empresa', $payload, 'update_company');

        $this->touchSynced($company);
    }

    /**
     * Cambia el entorno beta/producción (solo super admin).
     */
    public function pushEnvironment(Company $company, string $environment): void
    {
        SunatApiClient::forCompany($company)->put('empresa', ['entorno' => $environment], 'update_environment');
        $this->touchSynced($company);
    }

    /**
     * Opciones avanzadas (solo super admin): tasa IGV forzada y credenciales del API REST de SUNAT.
     */
    public function pushAdvanced(Company $company, ?float $igvOverride, ?string $clientId, ?string $clientSecret): void
    {
        $payload = ['igv_rate_override' => $igvOverride];

        if (filled($clientId)) {
            $payload['client_id'] = $clientId;
        }

        if (filled($clientSecret)) {
            $payload['client_secret'] = $clientSecret;
        }

        SunatApiClient::forCompany($company)->put('empresa', $payload, 'update_advanced');
        $this->touchSynced($company);
    }

    public function uploadLogo(Company $company, UploadedFile $logo): void
    {
        if (! $this->isConnected($company)) {
            return;
        }

        SunatApiClient::forCompany($company)->postMultipart('empresa/logo', [], ['logo' => $logo], 'upload_logo');
        $this->touchSynced($company);
    }

    /**
     * Reemplaza el certificado (solo super admin). El archivo no se guarda localmente.
     */
    public function uploadCertificate(Company $company, UploadedFile $certificate, string $password): void
    {
        SunatApiClient::forCompany($company)->postMultipart(
            'empresa/certificado',
            ['contrasena_certificado' => $password],
            ['certificado' => $certificate],
            'upload_certificate',
        );

        $company->billingSettings->forceFill([
            'certificate_uploaded_at' => now(),
            'certificate_uploaded_by' => auth()->id(),
        ])->save();

        $this->refreshFromApi($company);
    }

    /**
     * Lee GET /empresa y actualiza la tasa de IGV vigente y el vencimiento
     * del certificado (si la API los informa).
     *
     * @return array<string, mixed>|null Datos devueltos por la API.
     */
    public function refreshFromApi(Company $company): ?array
    {
        $response = SunatApiClient::forCompany($company)->get('empresa', operation: 'get_company');

        $settings = $company->billingSettings;
        $igv = $response->find('tasa_igv_vigente');
        $validTo = $response->find('certificado_vence', 'certificado_vencimiento', 'fecha_vencimiento_certificado', 'cert_expires_at', 'valid_to');

        $updates = ['last_synced_at' => now()];

        if (is_numeric($igv)) {
            $updates['igv_rate'] = (float) $igv;
        }

        if (is_string($validTo) && strtotime($validTo) !== false) {
            $updates['certificate_valid_to'] = Carbon::parse($validTo)->toDateString();
        }

        $settings->forceFill($updates)->save();

        return $response->datos;
    }

    // ---------------------------------------------------------------- Sucursales

    public function pushEstablishment(Establishment $establishment): void
    {
        $company = $establishment->company;

        if (! $this->isConnected($company)) {
            return;
        }

        $payload = array_filter([
            'nombre' => $establishment->name,
            'cod_local' => $establishment->local_code,
            'direccion' => $establishment->address,
            'ubigeo' => $establishment->ubigeo,
            'es_principal' => $establishment->is_main,
            'telefono' => $establishment->phone,
            'email' => $establishment->email,
        ], fn ($v) => $v !== null && $v !== '');

        $client = SunatApiClient::forCompany($company);

        if ($establishment->api_branch_id) {
            $client->put('sucursales/'.$establishment->api_branch_id, $payload, 'update_branch');
        } else {
            $response = $client->post('sucursales', $payload, 'create_branch');
            $id = $response->find('id');

            if (is_numeric($id)) {
                $establishment->forceFill(['api_branch_id' => (int) $id])->save();
            }
        }

        $this->touchSynced($company);
    }

    public function deleteEstablishment(Establishment $establishment): void
    {
        $company = $establishment->company;

        if (! $this->isConnected($company) || ! $establishment->api_branch_id) {
            return;
        }

        SunatApiClient::forCompany($company)->delete('sucursales/'.$establishment->api_branch_id, 'delete_branch');
    }

    /**
     * Vincula los establecimientos locales con las sucursales existentes en la
     * API (por cod_local) y crea en la API las que falten.
     */
    public function syncEstablishments(Company $company): void
    {
        $remote = $this->listOf(SunatApiClient::forCompany($company)->get('sucursales', ['por_pagina' => 100], 'list_branches'));

        foreach ($company->establishments()->withoutGlobalScopes()->get() as $establishment) {
            if ($establishment->api_branch_id) {
                continue;
            }

            $match = collect($remote)->first(fn ($b) => is_array($b) && (string) ($b['cod_local'] ?? '') === $establishment->local_code)
                ?? ($establishment->is_main ? collect($remote)->first(fn ($b) => is_array($b) && ! empty($b['es_principal'])) : null);

            if ($match && isset($match['id'])) {
                $establishment->forceFill(['api_branch_id' => (int) $match['id']])->save();
            } else {
                $establishment->setRelation('company', $company);
                $this->pushEstablishment($establishment);
            }
        }
    }

    // ---------------------------------------------------------------- Series

    public function pushSeries(DocumentSeries $series): void
    {
        $company = $series->company;

        if (! $this->isConnected($company)) {
            return;
        }

        $client = SunatApiClient::forCompany($company);

        if ($series->api_series_id) {
            $client->put('series/'.$series->api_series_id, ['is_active' => $series->is_active], 'update_series');
            $this->touchSynced($company);

            return;
        }

        $branchId = $series->establishment->api_branch_id;

        $response = $client->post('series', [
            'series' => [array_filter([
                'tipo' => $series->document_type->apiSeriesType(),
                'serie' => $series->series,
                'sucursal_id' => $branchId,
                'correlativo_inicial' => $series->initial_number,
            ], fn ($v) => $v !== null)],
        ], 'create_series');

        $created = collect($this->listOf($response))->first(fn ($s) => is_array($s) && ($s['serie'] ?? null) === $series->series);
        $id = $created['id'] ?? $response->find('id');

        if (is_numeric($id)) {
            $series->forceFill(['api_series_id' => (int) $id])->save();
        }

        $this->touchSynced($company);
    }

    /**
     * Vincula las series locales con las existentes en la API y crea las que falten.
     */
    public function syncSeries(Company $company): void
    {
        $remote = $this->listOf(SunatApiClient::forCompany($company)->get('series', ['por_pagina' => 100], 'list_series'));

        $local = DocumentSeries::query()->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->with('establishment')
            ->get();

        foreach ($local as $series) {
            if ($series->api_series_id) {
                continue;
            }

            $match = collect($remote)->first(fn ($s) => is_array($s) && ($s['serie'] ?? null) === $series->series);

            if ($match && isset($match['id'])) {
                $series->forceFill(['api_series_id' => (int) $match['id']])->save();
            } else {
                $series->setRelation('company', $company);
                $this->pushSeries($series);
            }
        }
    }

    /**
     * Normaliza listados: datos puede ser una lista o un paginador {data: [...]}.
     *
     * @return list<mixed>
     */
    private function listOf(ApiResponse $response): array
    {
        $datos = $response->datos ?? [];

        if (array_is_list($datos)) {
            return $datos;
        }

        foreach (['data', 'series', 'sucursales', 'items'] as $key) {
            if (isset($datos[$key]) && is_array($datos[$key]) && array_is_list($datos[$key])) {
                return $datos[$key];
            }
        }

        return [];
    }

    private function touchSynced(Company $company): void
    {
        $company->billingSettings?->forceFill(['last_synced_at' => now()])->save();
    }
}
