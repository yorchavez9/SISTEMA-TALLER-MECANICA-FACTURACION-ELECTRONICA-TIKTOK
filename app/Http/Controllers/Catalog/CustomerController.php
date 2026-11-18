<?php

namespace App\Http\Controllers\Catalog;

use App\Enums\IdentityDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\CustomerRequest;
use App\Models\Customer;
use App\Models\Vehicle;
use App\Services\Audit\ActivityLogger;
use App\Services\SunatApi\LookupService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    public function index(Request $request, LookupService $lookups, CurrentCompany $current): Response
    {
        Gate::authorize('viewAny', Customer::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'document_type' => ['nullable', 'string', 'max:1'],
        ]);
        $search = $filters['search'] ?? null;

        $customers = Customer::query()
            ->withCount('vehicles')
            ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('trade_name', 'like', "%{$s}%")
                ->orWhere('document_number', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")))
            ->when($filters['document_type'] ?? null, fn (Builder $q, string $t) => $q->where('document_type', $t))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Customer $c) => $this->row($c));

        return Inertia::render('customers/index', [
            'customers' => $customers,
            'filters' => ['search' => $search ?? '', 'document_type' => $filters['document_type'] ?? ''],
            'documentTypes' => IdentityDocumentType::options(),
            'lookupsAvailable' => $lookups->available($current->get()?->load('billingSettings')),
            'can' => ['manage' => $request->user()->can('create', Customer::class)],
        ]);
    }

    public function show(Request $request, Customer $customer, LookupService $lookups, CurrentCompany $current): Response
    {
        Gate::authorize('view', $customer);

        return Inertia::render('customers/show', [
            'customer' => [...$this->row($customer->loadCount('vehicles')), 'notes' => $customer->notes, 'created_at' => $customer->created_at?->toIso8601String()],
            'vehicles' => $customer->vehicles()->orderBy('plate')->get()->map(fn (Vehicle $v) => VehicleController::row($v)),
            'documentTypes' => IdentityDocumentType::options(),
            'lookupsAvailable' => $lookups->available($current->get()?->load('billingSettings')),
            'can' => [
                'manage' => $request->user()->can('update', $customer),
                'manageVehicles' => $request->user()->can('create', Vehicle::class),
            ],
        ]);
    }

    public function store(CustomerRequest $request): RedirectResponse
    {
        $customer = Customer::query()->create($request->validated());

        $this->activity->log('customer.created', "Se registró el cliente {$customer->name}.", $customer);
        $this->toastSuccess('Cliente registrado.');

        // Desde la OT (Fase 4) se puede pedir volver con el cliente creado.
        return $request->boolean('redirect_to_show')
            ? redirect()->route('customers.show', $customer)
            : back();
    }

    public function update(CustomerRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->validated());

        $this->activity->log('customer.updated', "Se actualizó el cliente {$customer->name}.", $customer);
        $this->toastSuccess('Cliente actualizado.');

        return back();
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        Gate::authorize('delete', $customer);

        if ($customer->vehicles()->exists()) {
            return back()->withErrors(['api' => 'El cliente tiene vehículos registrados. Elimine o reasigne sus vehículos primero.']);
        }

        $customer->delete();

        $this->activity->log('customer.deleted', "Se eliminó el cliente {$customer->name}.", $customer);
        $this->toastSuccess('Cliente eliminado.');

        return redirect()->route('customers.index');
    }

    /**
     * Búsqueda para selectores (combobox) de cliente.
     */
    public function search(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Customer::class);
        $term = trim((string) $request->query('q', ''));

        $customers = Customer::query()
            ->when($term !== '', fn (Builder $q) => $q->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$term}%")
                ->orWhere('document_number', 'like', "{$term}%")))
            ->orderBy('name')
            ->limit(15)
            ->get()
            ->map(fn (Customer $c) => ['id' => $c->id, 'name' => $c->name, 'document' => $c->documentLabel()]);

        return response()->json(['items' => $customers]);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Customer $c): array
    {
        return [
            'id' => $c->id,
            'document_type' => $c->document_type->value,
            'document_number' => $c->document_number,
            'document_label' => $c->documentLabel(),
            'name' => $c->name,
            'trade_name' => $c->trade_name,
            'address' => $c->address,
            'phone' => $c->phone,
            'email' => $c->email,
            'vehicles_count' => $c->vehicles_count ?? null,
        ];
    }
}
