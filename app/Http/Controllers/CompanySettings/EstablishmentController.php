<?php

namespace App\Http\Controllers\CompanySettings;

use App\Http\Controllers\Controller;
use App\Http\Requests\CompanySettings\EstablishmentRequest;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Services\Audit\ActivityLogger;
use App\Services\SunatApi\CompanyConfigSync;
use App\Services\SunatApi\Exceptions\SunatApiException;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class EstablishmentController extends Controller
{
    public function __construct(
        private readonly CurrentCompany $current,
        private readonly CompanyConfigSync $sync,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(): Response
    {
        $company = $this->current->getOrFail()->load('billingSettings');

        return Inertia::render('company-settings/establishments', [
            'establishments' => Establishment::query()
                ->withCount('series')
                ->orderByDesc('is_main')
                ->orderBy('local_code')
                ->get()
                ->map(fn (Establishment $e) => [
                    'id' => $e->id,
                    'name' => $e->name,
                    'local_code' => $e->local_code,
                    'address' => $e->address,
                    'ubigeo' => $e->ubigeo,
                    'phone' => $e->phone,
                    'email' => $e->email,
                    'is_main' => $e->is_main,
                    'synced' => $e->api_branch_id !== null,
                    'series_count' => $e->series_count,
                ]),
            'connected' => $company->billingSettings->hasCredentials(),
        ]);
    }

    public function store(EstablishmentRequest $request): RedirectResponse
    {
        $company = $this->current->getOrFail()->load('billingSettings');

        try {
            $establishment = DB::transaction(function () use ($request, $company): Establishment {
                $establishment = new Establishment([...$request->validated(), 'is_main' => false]);
                $establishment->company_id = $company->id;
                $establishment->save();
                $establishment->setRelation('company', $company);

                $this->sync->pushEstablishment($establishment);

                return $establishment;
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se creó el establecimiento');
        }

        $this->activity->log('establishment.created', "Se creó el establecimiento {$establishment->name} ({$establishment->local_code}).", $establishment);
        $this->toastSuccess('Establecimiento creado.');

        return back();
    }

    public function update(EstablishmentRequest $request, Establishment $establishment): RedirectResponse
    {
        $this->ensureOwned($establishment);
        $company = $this->current->getOrFail()->load('billingSettings');
        $data = $request->validated();

        // El principal conserva el código 0000 que exige SUNAT.
        if ($establishment->is_main) {
            $data['local_code'] = $establishment->local_code;
        }

        try {
            DB::transaction(function () use ($establishment, $data, $company): void {
                $establishment->fill($data)->save();
                $establishment->setRelation('company', $company);
                $this->sync->pushEstablishment($establishment);
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se guardó el establecimiento');
        }

        $this->activity->log('establishment.updated', "Se actualizó el establecimiento {$establishment->name}.", $establishment);
        $this->toastSuccess('Establecimiento actualizado.');

        return back();
    }

    public function destroy(Establishment $establishment): RedirectResponse
    {
        $this->ensureOwned($establishment);

        if ($establishment->is_main) {
            return back()->withErrors(['api' => 'El establecimiento principal no se puede eliminar.']);
        }

        if (DocumentSeries::query()->where('establishment_id', $establishment->id)->exists()) {
            return back()->withErrors(['api' => 'El establecimiento tiene series asociadas. Desactive o reasigne sus series primero.']);
        }

        $company = $this->current->getOrFail()->load('billingSettings');

        try {
            DB::transaction(function () use ($establishment, $company): void {
                $establishment->setRelation('company', $company);
                $this->sync->deleteEstablishment($establishment);
                $establishment->delete();
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se eliminó el establecimiento');
        }

        $this->activity->log('establishment.deleted', "Se eliminó el establecimiento {$establishment->name}.");
        $this->toastSuccess('Establecimiento eliminado.');

        return back();
    }

    private function ensureOwned(Establishment $establishment): void
    {
        abort_unless($establishment->company_id === $this->current->id(), 404);
    }
}
