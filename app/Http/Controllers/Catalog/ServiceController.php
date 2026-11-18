<?php

namespace App\Http\Controllers\Catalog;

use App\Enums\IgvAffectation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ServiceRequest;
use App\Models\DetractionType;
use App\Models\Service;
use App\Services\Audit\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Service::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);
        $search = $filters['search'] ?? null;

        $services = Service::query()
            ->with('detractionType:id,code,rate')
            ->when($search, fn (Builder $q, string $s) => $q->where('name', 'like', "%{$s}%"))
            ->when(($filters['status'] ?? null) === 'active', fn (Builder $q) => $q->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn (Builder $q) => $q->where('is_active', false))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Service $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'description' => $s->description,
                'price' => $s->price,
                'igv_affectation' => $s->igv_affectation->value,
                'igv_affectation_label' => $s->igv_affectation->label(),
                'sunat_product_code' => $s->sunat_product_code,
                'subject_to_detraction' => $s->subject_to_detraction,
                'detraction_type_id' => $s->detraction_type_id,
                'detraction_label' => $s->detractionType ? $s->detractionType->code.' ('.$s->detractionType->rate.' %)' : null,
                'is_active' => $s->is_active,
            ]);

        return Inertia::render('services/index', [
            'services' => $services,
            'filters' => ['search' => $search ?? '', 'status' => $filters['status'] ?? ''],
            'igvAffectations' => IgvAffectation::options(),
            'detractionTypes' => DetractionType::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('code')->get()
                ->map(fn (DetractionType $t) => ['value' => (string) $t->id, 'label' => "{$t->code} · {$t->description} ({$t->rate} %)"]),
            'can' => ['manage' => $request->user()->can('create', Service::class)],
        ]);
    }

    public function store(ServiceRequest $request): RedirectResponse
    {
        $service = Service::query()->create([
            ...$request->validated(),
            'subject_to_detraction' => $request->boolean('subject_to_detraction', true),
            'is_active' => $request->boolean('is_active', true),
        ]);

        $this->activity->log('service.created', "Se registró el servicio {$service->name}.", $service);
        $this->toastSuccess('Servicio registrado.');

        return back();
    }

    public function update(ServiceRequest $request, Service $service): RedirectResponse
    {
        $service->update([
            ...$request->validated(),
            'subject_to_detraction' => $request->boolean('subject_to_detraction'),
            'is_active' => $request->boolean('is_active'),
        ]);

        $this->activity->log('service.updated', "Se actualizó el servicio {$service->name}.", $service);
        $this->toastSuccess('Servicio actualizado.');

        return back();
    }

    public function destroy(Service $service): RedirectResponse
    {
        Gate::authorize('delete', $service);

        $service->delete();

        $this->activity->log('service.deleted', "Se eliminó el servicio {$service->name}.", $service);
        $this->toastSuccess('Servicio eliminado.');

        return back();
    }
}
