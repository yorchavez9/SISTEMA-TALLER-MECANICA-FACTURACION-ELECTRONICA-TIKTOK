<?php

namespace App\Http\Controllers\Sales;

use App\Enums\DocumentType;
use App\Enums\IdentityDocumentType;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Documents\ElectronicDocumentController;
use App\Models\DetractionType;
use App\Models\DocumentSeries;
use App\Models\ElectronicDocument;
use App\Services\Sales\DetractionCalculator;
use App\Http\Requests\Sales\SaleRequest;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalePayment;
use App\Models\WorkOrder;
use App\Services\Sales\SaleService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SaleController extends Controller
{
    public function __construct(
        private readonly SaleService $sales,
        private readonly CurrentCompany $current,
        private readonly DetractionCalculator $detraction,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Sale::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:registered,voided'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $search = $filters['search'] ?? null;

        $query = Sale::query()
            ->with(['customer:id,name,document_type,document_number', 'workOrder:id,number', 'payments:id,sale_id,method,amount'])
            ->when($search, function (Builder $q, string $s): void {
                $number = (int) preg_replace('/\D/', '', $s);
                $q->where(fn (Builder $q) => $q
                    ->when($number > 0, fn (Builder $q) => $q->orWhere('number', $number))
                    ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', "%{$s}%")->orWhere('document_number', 'like', "{$s}%")));
            })
            ->when($filters['status'] ?? null, fn (Builder $q, string $st) => $q->where('status', $st))
            ->when($filters['from'] ?? null, fn (Builder $q, string $d) => $q->where('issued_at', '>=', $d.' 00:00:00'))
            ->when($filters['to'] ?? null, fn (Builder $q, string $d) => $q->where('issued_at', '<=', $d.' 23:59:59'));

        $summary = (clone $query)->where('status', Sale::STATUS_REGISTERED)->selectRaw('count(*) as count, coalesce(sum(total), 0) as total')->first();

        $sales = $query->orderByDesc('issued_at')->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Sale $s) => [
                'id' => $s->id,
                'code' => $s->code(),
                'customer' => $s->customer ? ['name' => $s->customer->name, 'document' => $s->customer->documentLabel()] : null,
                'work_order' => $s->workOrder ? ['id' => $s->workOrder->id, 'code' => $s->workOrder->code()] : null,
                'issued_at' => $s->issued_at->toIso8601String(),
                'total' => $s->total,
                'status' => $s->status,
                'payment_methods' => $s->payments->map(fn (SalePayment $p) => $p->method->label())->unique()->values(),
            ]);

        return Inertia::render('sales/index', [
            'sales' => $sales,
            'summary' => ['count' => (int) $summary->count, 'total' => number_format((float) $summary->total, 2, '.', '')],
            'filters' => [
                'search' => $search ?? '',
                'status' => $filters['status'] ?? '',
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'can' => ['create' => $request->user()->can('create', Sale::class)],
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', Sale::class);

        $customer = $request->integer('customer') ? Customer::query()->find($request->integer('customer')) : null;

        return Inertia::render('sales/create', [
            'paymentMethods' => PaymentMethod::options(),
            'preselectedCustomer' => $customer ? ['id' => $customer->id, 'name' => $customer->name, 'document' => $customer->documentLabel()] : null,
        ]);
    }

    /**
     * Venta directa (mostrador).
     */
    public function store(SaleRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $customer = Customer::query()->findOrFail($data['customer_id']);

        $sale = $this->sales->direct($this->current->getOrFail(), $customer, $data['items'], $data['payments'], $data['notes'] ?? null);

        $this->toastSuccess("Venta {$sale->code()} registrada.");

        return redirect()->route('sales.show', $sale);
    }

    /**
     * Venta desde una OT finalizada: los ítems se copian de la orden.
     */
    public function storeFromWorkOrder(SaleRequest $request, WorkOrder $workOrder): RedirectResponse
    {
        $data = $request->validated();
        $sale = $this->sales->fromWorkOrder($workOrder, $data['payments'], $data['notes'] ?? null);

        $this->toastSuccess("Venta {$sale->code()} registrada para la {$workOrder->code()}.");

        return redirect()->route('sales.show', $sale);
    }

    public function show(Request $request, Sale $sale): Response
    {
        Gate::authorize('view', $sale);

        $sale->load(['customer', 'workOrder.vehicle', 'items', 'payments', 'creator:id,first_name,last_name', 'voider:id,first_name,last_name']);

        $documents = $sale->electronicDocuments()->with('notes')->orderByDesc('id')->get();
        $activeDocument = $documents->first(fn (ElectronicDocument $d) => $d->issuance_key !== null);

        return Inertia::render('sales/show', [
            'sale' => [
                'id' => $sale->id,
                'code' => $sale->code(),
                'status' => $sale->status,
                'issued_at' => $sale->issued_at->toIso8601String(),
                'currency' => $sale->currency,
                'subtotal' => $sale->subtotal,
                'igv' => $sale->igv,
                'total' => $sale->total,
                'notes' => $sale->notes,
                'created_by' => $sale->creator?->name,
                'voided_at' => $sale->voided_at?->toIso8601String(),
                'voided_by' => $sale->voider?->name,
                'void_reason' => $sale->void_reason,
                'customer' => [
                    'id' => $sale->customer->id,
                    'name' => $sale->customer->name,
                    'document' => $sale->customer->documentLabel(),
                    'document_type' => $sale->customer->document_type->value,
                    'address' => $sale->customer->address,
                ],
                'work_order' => $sale->workOrder ? [
                    'id' => $sale->workOrder->id,
                    'code' => $sale->workOrder->code(),
                    'vehicle' => $sale->workOrder->vehicle?->formattedPlate(),
                ] : null,
            ],
            'items' => $sale->items->map(fn (SaleItem $i) => [
                'id' => $i->id,
                'type' => $i->type,
                'code' => $i->code,
                'description' => $i->description,
                'unit' => $i->unit,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'subtotal' => $i->subtotal,
                'igv' => $i->igv,
                'total' => $i->total,
                'subject_to_detraction' => $i->subject_to_detraction,
            ]),
            'payments' => $sale->payments->map(fn (SalePayment $p) => [
                'id' => $p->id,
                'method' => $p->method->value,
                'method_label' => $p->method->label(),
                'amount' => $p->amount,
                'reference' => $p->reference,
                'paid_at' => $p->paid_at->toIso8601String(),
            ]),
            'documents' => $documents->map(fn (ElectronicDocument $d) => [
                ...ElectronicDocumentController::row($d),
                'notes' => $d->notes->map(fn (ElectronicDocument $n) => ElectronicDocumentController::row($n))->values(),
            ])->values(),
            'emission' => $this->emissionOptions($sale, $activeDocument !== null),
            'can' => [
                'void' => $request->user()->can('void', $sale) && ! $sale->isVoided() && $activeDocument === null,
                'issue' => $request->user()->can('documents.issue'),
                'creditNote' => $request->user()->can('documents.credit_note'),
            ],
        ]);
    }

    /**
     * Opciones para el diálogo "Emitir comprobante".
     *
     * @return array<string, mixed>
     */
    private function emissionOptions(Sale $sale, bool $hasActiveDocument): array
    {
        $company = $this->current->getOrFail()->load('billingSettings');
        $settings = $company->billingSettings;
        $customer = $sale->customer;

        $series = DocumentSeries::query()
            ->where('is_active', true)
            ->whereIn('document_type', [DocumentType::Invoice->value, DocumentType::Receipt->value])
            ->orderBy('series')
            ->get(['id', 'document_type', 'series', 'last_number']);

        return [
            'available' => ! $sale->isVoided() && ! $hasActiveDocument,
            'ready' => $settings?->isReady() ?? false,
            'environment' => $settings?->environment,
            'nrus' => $settings?->tax_regime === 'rus',
            'customer_has_ruc' => $customer->document_type === IdentityDocumentType::Ruc && filled($customer->document_number),
            'customer_identified' => $customer->document_type !== IdentityDocumentType::None && filled($customer->document_number),
            'series' => [
                '01' => $series->where('document_type', DocumentType::Invoice)->map(fn (DocumentSeries $s) => ['value' => (string) $s->id, 'label' => $s->series.' (siguiente: '.($s->last_number + 1).')'])->values(),
                '03' => $series->where('document_type', DocumentType::Receipt)->map(fn (DocumentSeries $s) => ['value' => (string) $s->id, 'label' => $s->series.' (siguiente: '.($s->last_number + 1).')'])->values(),
            ],
            'detraction' => $this->detraction->suggestion($sale, $company),
            'detractionTypes' => DetractionType::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('code')->get()
                ->map(fn (DetractionType $t) => ['value' => (string) $t->id, 'label' => "{$t->code} · {$t->description}", 'rate' => $t->rate])->values(),
        ];
    }

    public function void(Request $request, Sale $sale): RedirectResponse
    {
        Gate::authorize('void', $sale);

        $validated = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:255']], [], ['reason' => 'motivo']);

        $this->sales->void($sale, $validated['reason']);
        $this->toastSuccess("Venta {$sale->code()} anulada. El stock de repuestos fue devuelto.");

        return back();
    }
}
