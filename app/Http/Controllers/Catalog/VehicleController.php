<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\VehicleRequest;
use App\Models\Vehicle;
use App\Services\Audit\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class VehicleController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Vehicle::class);

        $filters = $request->validate(['search' => ['nullable', 'string', 'max:100']]);
        $search = $filters['search'] ?? null;
        $plate = Vehicle::normalizePlate($search);

        $vehicles = Vehicle::query()
            ->with('customer:id,name,document_type,document_number')
            ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->when($plate !== '', fn (Builder $q) => $q->where('plate', 'like', "%{$plate}%"))
                ->orWhere('brand', 'like', "%{$s}%")
                ->orWhere('model', 'like', "%{$s}%")
                ->orWhereHas('customer', fn (Builder $q) => $q->where('name', 'like', "%{$s}%"))))
            ->orderBy('plate')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Vehicle $v) => self::row($v, withCustomer: true));

        return Inertia::render('vehicles/index', [
            'vehicles' => $vehicles,
            'filters' => ['search' => $search ?? ''],
            'can' => ['manage' => $request->user()->can('create', Vehicle::class)],
        ]);
    }

    public function store(VehicleRequest $request): RedirectResponse
    {
        $vehicle = Vehicle::query()->create([...$request->validated(), 'current_mileage' => $request->integer('current_mileage')]);

        $this->activity->log('vehicle.created', "Se registró el vehículo {$vehicle->formattedPlate()}.", $vehicle);
        $this->toastSuccess("Vehículo {$vehicle->formattedPlate()} registrado.");

        return back();
    }

    public function update(VehicleRequest $request, Vehicle $vehicle): RedirectResponse
    {
        $vehicle->update([...$request->validated(), 'current_mileage' => $request->integer('current_mileage')]);

        $this->activity->log('vehicle.updated', "Se actualizó el vehículo {$vehicle->formattedPlate()}.", $vehicle);
        $this->toastSuccess('Vehículo actualizado.');

        return back();
    }

    public function destroy(Vehicle $vehicle): RedirectResponse
    {
        Gate::authorize('delete', $vehicle);

        $vehicle->delete();

        $this->activity->log('vehicle.deleted', "Se eliminó el vehículo {$vehicle->formattedPlate()}.", $vehicle);
        $this->toastSuccess('Vehículo eliminado.');

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    public static function row(Vehicle $v, bool $withCustomer = false): array
    {
        return [
            'id' => $v->id,
            'customer_id' => $v->customer_id,
            'plate' => $v->plate,
            'plate_display' => $v->formattedPlate(),
            'brand' => $v->brand,
            'model' => $v->model,
            'year' => $v->year,
            'color' => $v->color,
            'vin' => $v->vin,
            'engine_number' => $v->engine_number,
            'current_mileage' => $v->current_mileage,
            'features' => $v->features,
            'notes' => $v->notes,
            'customer' => $withCustomer && $v->customer ? [
                'id' => $v->customer->id,
                'name' => $v->customer->name,
                'document' => $v->customer->documentLabel(),
            ] : null,
        ];
    }
}
