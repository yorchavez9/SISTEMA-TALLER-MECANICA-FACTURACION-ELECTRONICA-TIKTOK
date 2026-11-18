<?php

namespace App\Http\Controllers\CompanySettings;

use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\CompanySettings\StoreSeriesRequest;
use App\Models\DocumentSeries;
use App\Models\Establishment;
use App\Services\Audit\ActivityLogger;
use App\Services\SunatApi\CompanyConfigSync;
use App\Services\SunatApi\Exceptions\SunatApiException;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Series de comprobantes. No se eliminan: se activan o desactivan.
 */
class SeriesController extends Controller
{
    public function __construct(
        private readonly CurrentCompany $current,
        private readonly CompanyConfigSync $sync,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(): Response
    {
        $company = $this->current->getOrFail()->load('billingSettings');

        return Inertia::render('company-settings/series', [
            'series' => DocumentSeries::query()
                ->with('establishment:id,name,local_code')
                ->orderBy('document_type')
                ->orderBy('series')
                ->get()
                ->map(fn (DocumentSeries $s) => [
                    'id' => $s->id,
                    'document_type' => $s->document_type->value,
                    'document_type_label' => $s->document_type->label(),
                    'series' => $s->series,
                    'initial_number' => $s->initial_number,
                    'last_number' => $s->last_number,
                    'is_active' => $s->is_active,
                    'synced' => $s->api_series_id !== null,
                    'establishment' => $s->establishment ? $s->establishment->local_code.' · '.$s->establishment->name : null,
                ]),
            'establishments' => Establishment::query()->orderByDesc('is_main')->orderBy('local_code')
                ->get(['id', 'name', 'local_code'])
                ->map(fn (Establishment $e) => ['value' => (string) $e->id, 'label' => $e->local_code.' · '.$e->name]),
            'documentTypes' => DocumentType::options(),
            'connected' => $company->billingSettings->hasCredentials(),
        ]);
    }

    public function store(StoreSeriesRequest $request): RedirectResponse
    {
        $company = $this->current->getOrFail()->load('billingSettings');
        $data = $request->validated();

        try {
            $series = DB::transaction(function () use ($data, $company): DocumentSeries {
                $series = new DocumentSeries([
                    'establishment_id' => (int) $data['establishment_id'],
                    'document_type' => DocumentType::from($data['document_type']),
                    'series' => $data['series'],
                    'initial_number' => (int) ($data['initial_number'] ?? 0),
                    'is_active' => true,
                ]);
                $series->company_id = $company->id;
                $series->last_number = (int) ($data['initial_number'] ?? 0);
                $series->save();
                $series->setRelation('company', $company);
                $series->load('establishment');

                $this->sync->pushSeries($series);

                return $series;
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se creó la serie');
        }

        $this->activity->log('series.created', "Se creó la serie {$series->series} ({$series->document_type->label()}).", $series);
        $this->toastSuccess("Serie {$series->series} creada.");

        return back();
    }

    public function update(Request $request, DocumentSeries $series): RedirectResponse
    {
        abort_unless($series->company_id === $this->current->id(), 404);
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $company = $this->current->getOrFail()->load('billingSettings');

        try {
            DB::transaction(function () use ($series, $validated, $company): void {
                $series->forceFill(['is_active' => $validated['is_active']])->save();
                $series->setRelation('company', $company);
                $series->load('establishment');
                $this->sync->pushSeries($series);
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se actualizó la serie');
        }

        $this->activity->log($validated['is_active'] ? 'series.activated' : 'series.deactivated', ($validated['is_active'] ? 'Se activó' : 'Se desactivó')." la serie {$series->series}.", $series);
        $this->toastSuccess($validated['is_active'] ? "Serie {$series->series} activada." : "Serie {$series->series} desactivada.");

        return back();
    }
}
