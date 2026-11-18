<?php

namespace App\Http\Controllers\CompanySettings;

use App\Enums\TaxRegime;
use App\Http\Controllers\Controller;
use App\Http\Requests\CompanySettings\UpdateCompanyProfileRequest;
use App\Services\Audit\ActivityLogger;
use App\Services\SunatApi\CompanyConfigSync;
use App\Services\SunatApi\Exceptions\SunatApiException;
use App\Services\SunatApi\LookupService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Datos de empresa y fiscales del taller. Si el taller ya está registrado en
 * la API, cada guardado se sincroniza (PUT /empresa) dentro de la misma
 * transacción: si la API rechaza, no se guarda nada.
 */
class ProfileController extends Controller
{
    public function __construct(private readonly CurrentCompany $current) {}

    public function edit(LookupService $lookups): Response
    {
        $company = $this->current->getOrFail()->load('billingSettings');
        $s = $company->billingSettings;

        return Inertia::render('company-settings/profile', [
            'profile' => [
                'ruc' => $company->ruc,
                'legal_name' => $company->legal_name,
                'trade_name' => $company->trade_name,
                'email' => $company->email,
                'phone' => $company->phone,
                'logo_url' => $company->logoUrl(),
                'fiscal_address' => $s->fiscal_address,
                'ubigeo' => $s->ubigeo,
                'department' => $s->department,
                'province' => $s->province,
                'district' => $s->district,
                'tax_regime' => $s->tax_regime,
                'nrus_category' => $s->nrus_category,
                'thanks_message' => $s->thanks_message,
            ],
            'connected' => $s->hasCredentials(),
            'lookupsAvailable' => $lookups->available($company),
            'taxRegimes' => TaxRegime::options(),
        ]);
    }

    public function update(UpdateCompanyProfileRequest $request, CompanyConfigSync $sync, ActivityLogger $activity): RedirectResponse
    {
        $company = $this->current->getOrFail()->load('billingSettings');
        $data = $request->validated();

        try {
            DB::transaction(function () use ($company, $data, $sync): void {
                $company->fill([
                    'ruc' => $data['ruc'],
                    'legal_name' => $data['legal_name'],
                    'trade_name' => $data['trade_name'] ?? null,
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'] ?? null,
                ])->save();

                $company->billingSettings->fill([
                    'fiscal_address' => $data['fiscal_address'],
                    'ubigeo' => $data['ubigeo'],
                    'department' => $data['department'],
                    'province' => $data['province'],
                    'district' => $data['district'],
                    'tax_regime' => $data['tax_regime'],
                    'nrus_category' => $data['tax_regime'] === 'rus' ? ($data['nrus_category'] ?? null) : null,
                    'thanks_message' => $data['thanks_message'] ?? null,
                ])->save();

                $sync->pushProfile($company);
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se guardaron los cambios');
        }

        $activity->log('company.profile_updated', 'Se actualizaron los datos de la empresa.', $company);
        $this->toastSuccess($company->billingSettings->hasCredentials() ? 'Datos guardados y sincronizados con la API.' : 'Datos guardados.');

        return back();
    }

    /**
     * Logo de los comprobantes PDF. Se guarda en el disco público y se envía a la API.
     */
    public function updateLogo(Request $request, CompanyConfigSync $sync, ActivityLogger $activity): RedirectResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png', 'mimetypes:image/jpeg,image/png', 'max:1024', 'dimensions:max_width=2000,max_height=2000'],
        ], [], ['logo' => 'logo']);

        $company = $this->current->getOrFail()->load('billingSettings');
        $file = $request->file('logo');
        $path = $file->storeAs('companies/'.$company->id.'/logo', Str::uuid().'.'.$file->extension(), 'public');
        $previous = $company->logo_path;

        try {
            DB::transaction(function () use ($company, $path, $file, $sync): void {
                $company->forceFill(['logo_path' => $path])->save();
                $sync->uploadLogo($company, $file);
            });
        } catch (SunatApiException $e) {
            Storage::disk('public')->delete($path);

            return $this->backWithApiError($e, 'La API rechazó el logo');
        }

        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        $activity->log('company.logo_updated', 'Se actualizó el logo de la empresa.', $company);
        $this->toastSuccess('Logo actualizado.');

        return back();
    }
}
