<?php

namespace App\Http\Controllers\WorkOrders;

use App\Enums\PaymentMethod;
use App\Enums\WorkOrderStatus;
use App\Models\Sale;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkOrders\WorkOrderItemRequest;
use App\Http\Requests\WorkOrders\WorkOrderRequest;
use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Vehicle;
use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Services\WorkOrders\WorkOrderService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class WorkOrderController extends Controller
{
    public function __construct(
        private readonly WorkOrderService $orders,
        private readonly CurrentCompany $current,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', WorkOrder::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', Rule::in([...array_column(WorkOrderStatus::cases(), 'value'), 'open'])],
            'mine' => ['nullable', 'boolean'],
        ]);
        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? 'open';
        $plate = Vehicle::normalizePlate($search);

        $orders = WorkOrder::query()
            ->with(['customer:id,name', 'vehicle:id,plate,brand,model', 'assignedUser:id,first_name,last_name'])
            ->when($status === 'open', fn (Builder $q) => $q->whereNotIn('status', [WorkOrderStatus::Delivered, WorkOrderStatus::Cancelled]))
            ->when($status !== 'open', fn (Builder $q) => $q->where('status', $status))
            ->when($request->boolean('mine'), fn (Builder $q) => $q->where('assigned_user_id', $request->user()->id))
            ->when($search, function (Builder $q, string $s) use ($plate): void {
                $number = (int) preg_replace('/\D/', '', $s);
                $q->where(fn (Builder $q) => $q
                    ->when($number > 0, fn (Builder $q) => $q->orWhere('number', $number))
                    ->when($plate !== '', fn (Builder $q) => $q->orWhereHas('vehicle', fn (Builder $v) => $v->where('plate', 'like', "%{$plate}%")))
                    ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$s}%")));
            })
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (WorkOrder $o) => [
                'id' => $o->id,
                'code' => $o->code(),
                'status' => $o->status->value,
                'status_label' => $o->status->label(),
                'status_tone' => $o->status->tone(),
                'customer' => $o->customer?->name,
                'vehicle' => $o->vehicle ? $o->vehicle->formattedPlate().' · '.$o->vehicle->brand.' '.$o->vehicle->model : null,
                'assigned_to' => $o->assignedUser?->name,
                'received_at' => $o->received_at->toIso8601String(),
                'promised_at' => $o->promised_at?->toIso8601String(),
                'total' => $o->total,
            ]);

        return Inertia::render('work-orders/index', [
            'orders' => $orders,
            'filters' => ['search' => $search ?? '', 'status' => $status, 'mine' => $request->boolean('mine')],
            'statuses' => WorkOrderStatus::options(),
            'can' => ['create' => $request->user()->can('create', WorkOrder::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', WorkOrder::class);

        // Preselección opcional desde la ficha de cliente/vehículo.
        $vehicle = $request->integer('vehicle') ? Vehicle::query()->with('customer')->find($request->integer('vehicle')) : null;
        $customer = $vehicle?->customer ?? ($request->integer('customer') ? Customer::query()->find($request->integer('customer')) : null);

        return Inertia::render('work-orders/create', [
            'mechanics' => WorkOrderRequest::mechanicOptions((int) $this->current->id()),
            'preselected' => [
                'customer' => $customer ? ['id' => $customer->id, 'name' => $customer->name, 'document' => $customer->documentLabel()] : null,
                'vehicle_id' => $vehicle?->id,
            ],
        ]);
    }

    public function store(WorkOrderRequest $request): RedirectResponse
    {
        $order = $this->orders->create($this->current->getOrFail(), $request->validated());

        $this->toastSuccess("Orden {$order->code()} registrada.");

        return redirect()->route('work-orders.show', $order);
    }

    public function show(Request $request, WorkOrder $workOrder): Response
    {
        Gate::authorize('view', $workOrder);

        $workOrder->load(['customer', 'vehicle', 'assignedUser:id,first_name,last_name', 'creator:id,first_name,last_name', 'items.product:id,stock,unit', 'sale:id,work_order_id,number,status,total']);
        $status = $workOrder->status;
        $user = $request->user();

        $hasActiveSale = $workOrder->sale !== null && ! $workOrder->sale->isVoided();

        $transitions = collect($status->allowedTransitions())
            ->reject(fn (WorkOrderStatus $s) => $s === WorkOrderStatus::Cancelled && ! $user->can('cancel', $workOrder))
            // Entregar requiere la venta registrada; reabrir no se permite con venta activa.
            ->reject(fn (WorkOrderStatus $s) => $s === WorkOrderStatus::Delivered && ! $hasActiveSale)
            ->reject(fn (WorkOrderStatus $s) => $status === WorkOrderStatus::Finished && $s === WorkOrderStatus::InProgress && $hasActiveSale)
            ->map(fn (WorkOrderStatus $s) => ['value' => $s->value, 'label' => $s->label(), 'tone' => $s->tone()])
            ->values();

        return Inertia::render('work-orders/show', [
            'order' => [
                'id' => $workOrder->id,
                'code' => $workOrder->code(),
                'status' => $status->value,
                'status_label' => $status->label(),
                'status_tone' => $status->tone(),
                'editable' => $status->isEditable(),
                'customer' => [
                    'id' => $workOrder->customer->id,
                    'name' => $workOrder->customer->name,
                    'document' => $workOrder->customer->documentLabel(),
                    'phone' => $workOrder->customer->phone,
                ],
                'vehicle' => [
                    'id' => $workOrder->vehicle->id,
                    'plate' => $workOrder->vehicle->formattedPlate(),
                    'description' => trim($workOrder->vehicle->brand.' '.$workOrder->vehicle->model.' '.($workOrder->vehicle->year ?? '')),
                    'color' => $workOrder->vehicle->color,
                    'current_mileage' => $workOrder->vehicle->current_mileage,
                ],
                'assigned_user_id' => $workOrder->assigned_user_id,
                'assigned_to' => $workOrder->assignedUser?->name,
                'created_by' => $workOrder->creator?->name,
                'mileage_in' => $workOrder->mileage_in,
                'reported_problem' => $workOrder->reported_problem,
                'diagnosis' => $workOrder->diagnosis,
                'observations' => $workOrder->observations,
                'received_at' => $workOrder->received_at->toIso8601String(),
                'promised_at' => $workOrder->promised_at?->toDateString(),
                'finished_at' => $workOrder->finished_at?->toIso8601String(),
                'delivered_at' => $workOrder->delivered_at?->toIso8601String(),
                'cancelled_at' => $workOrder->cancelled_at?->toIso8601String(),
                'subtotal' => $workOrder->subtotal,
                'igv' => $workOrder->igv,
                'total' => $workOrder->total,
            ],
            'items' => $workOrder->items->map(fn (WorkOrderItem $i) => [
                'id' => $i->id,
                'type' => $i->type,
                'type_label' => WorkOrderItem::TYPES[$i->type] ?? $i->type,
                'description' => $i->description,
                'unit' => $i->unit,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'subtotal' => $i->subtotal,
                'igv' => $i->igv,
                'total' => $i->total,
                // Aviso (no bloqueo): el stock se descuenta al registrar la venta.
                'stock_available' => $i->product?->stock,
                'stock_warning' => $i->product !== null && (float) $i->quantity > (float) $i->product->stock,
            ]),
            'timeline' => ActivityLog::query()
                ->where('subject_type', $workOrder->getMorphClass())
                ->where('subject_id', $workOrder->id)
                ->with('user:id,first_name,last_name')
                ->latest('created_at')
                ->latest('id')
                ->get()
                ->map(fn (ActivityLog $log) => [
                    'id' => $log->id,
                    'action' => $log->action,
                    'description' => $log->description,
                    'note' => $log->properties['note'] ?? null,
                    'to' => $log->properties['to'] ?? null,
                    'user' => $log->user?->name,
                    'created_at' => $log->created_at->toIso8601String(),
                ]),
            'transitions' => $transitions,
            'statuses' => WorkOrderStatus::options(),
            'mechanics' => WorkOrderRequest::mechanicOptions((int) $this->current->id()),
            'itemTypes' => collect(WorkOrderItem::TYPES)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values(),
            'sale' => $workOrder->sale ? [
                'id' => $workOrder->sale->id,
                'code' => $workOrder->sale->code(),
                'status' => $workOrder->sale->status,
                'total' => $workOrder->sale->total,
            ] : null,
            'paymentMethods' => PaymentMethod::options(),
            'can' => [
                'update' => $user->can('update', $workOrder),
                'cancel' => $user->can('cancel', $workOrder),
                'createSale' => $user->can('create', Sale::class)
                    && $status === WorkOrderStatus::Finished
                    && ($workOrder->sale === null || $workOrder->sale->isVoided()),
            ],
        ]);
    }

    public function update(WorkOrderRequest $request, WorkOrder $workOrder): RedirectResponse
    {
        $this->orders->update($workOrder, $request->validated());
        $this->toastSuccess('Orden actualizada.');

        return back();
    }

    public function changeStatus(Request $request, WorkOrder $workOrder): RedirectResponse
    {
        Gate::authorize('update', $workOrder);

        $validated = $request->validate([
            'status' => ['required', Rule::enum(WorkOrderStatus::class)],
            'note' => ['nullable', 'string', 'max:500'],
        ], [], ['status' => 'estado', 'note' => 'nota']);

        $target = WorkOrderStatus::from($validated['status']);

        if ($target === WorkOrderStatus::Cancelled) {
            Gate::authorize('cancel', $workOrder);
        }

        $this->orders->changeStatus($workOrder, $target, $validated['note'] ?? null);
        $this->toastSuccess("Orden {$workOrder->code()}: {$target->label()}.");

        return back();
    }

    public function storeItem(WorkOrderItemRequest $request, WorkOrder $workOrder): RedirectResponse
    {
        $this->orders->addItem($workOrder, $request->validated());
        $this->toastSuccess('Ítem agregado.');

        return back();
    }

    public function updateItem(WorkOrderItemRequest $request, WorkOrder $workOrder, WorkOrderItem $item): RedirectResponse
    {
        $this->orders->updateItem($workOrder, $item, $request->validated());
        $this->toastSuccess('Ítem actualizado.');

        return back();
    }

    public function destroyItem(WorkOrder $workOrder, WorkOrderItem $item): RedirectResponse
    {
        Gate::authorize('update', $workOrder);

        $this->orders->removeItem($workOrder, $item);
        $this->toastSuccess('Ítem eliminado.');

        return back();
    }

    /**
     * Hoja imprimible de la OT (HTML simple para imprimir o guardar como PDF).
     */
    public function print(WorkOrder $workOrder): View
    {
        Gate::authorize('view', $workOrder);

        $workOrder->load(['customer', 'vehicle', 'items', 'assignedUser:id,first_name,last_name']);
        $company = $this->current->getOrFail()->load('billingSettings');

        return view('work-orders.print', ['order' => $workOrder, 'company' => $company]);
    }
}
