<?php

namespace App\Http\Controllers\Catalog;

use App\Enums\IgvAffectation;
use App\Enums\UnitOfMeasure;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ProductRequest;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\Audit\ActivityLogger;
use App\Services\Inventory\StockService;
use App\Services\Media\ProductImageService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $activity,
        private readonly ProductImageService $images,
        private readonly StockService $stock,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Product::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,inactive,low_stock'],
        ]);
        $search = $filters['search'] ?? null;
        $status = $filters['status'] ?? null;

        $products = Product::query()
            ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$s}%")
                ->orWhere('code', 'like', "%{$s}%")))
            ->when($status === 'active', fn (Builder $q) => $q->where('is_active', true))
            ->when($status === 'inactive', fn (Builder $q) => $q->where('is_active', false))
            ->when($status === 'low_stock', fn (Builder $q) => $q->whereNotNull('min_stock')->whereColumn('stock', '<=', 'min_stock'))
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Product $p) => $this->row($p));

        return Inertia::render('products/index', [
            'products' => $products,
            'filters' => ['search' => $search ?? '', 'status' => $status ?? ''],
            'can' => [
                'manage' => $request->user()->can('create', Product::class),
                'adjustStock' => $request->user()->can('stock.adjust'),
            ],
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Product::class);

        return Inertia::render('products/form', [
            'product' => null,
            ...$this->formOptions(),
        ]);
    }

    public function store(ProductRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $product = DB::transaction(function () use ($data): Product {
            $product = Product::query()->create([
                ...collect($data)->except(['image', 'remove_image', 'initial_stock'])->all(),
                'cost' => $data['cost'] ?? 0,
                'is_active' => $data['is_active'] ?? true,
            ]);

            $initial = (float) ($data['initial_stock'] ?? 0);
            if ($initial > 0) {
                $this->stock->move($product, $initial, 'in', 'Stock inicial');
            }

            return $product;
        });

        if ($request->hasFile('image')) {
            $this->images->replace($product, $request->file('image'));
        }

        $this->activity->log('product.created', "Se registró el producto {$product->code} · {$product->name}.", $product);
        $this->toastSuccess('Producto registrado.');

        return redirect()->route('products.show', $product);
    }

    public function show(Request $request, Product $product): Response
    {
        Gate::authorize('view', $product);

        $movements = StockMovement::query()
            ->where('product_id', $product->id)
            ->with('user:id,first_name,last_name')
            ->latest('created_at')
            ->latest('id')
            ->paginate(10)
            ->through(fn (StockMovement $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'type_label' => StockMovement::TYPES[$m->type] ?? $m->type,
                'quantity' => $m->quantity,
                'balance_after' => $m->balance_after,
                'reason' => $m->reason,
                'user' => $m->user?->name,
                'created_at' => $m->created_at->toIso8601String(),
            ]);

        return Inertia::render('products/show', [
            'product' => [
                ...$this->row($product),
                'description' => $product->description,
                'image_url' => $product->imageUrl(),
                'created_at' => $product->created_at?->toIso8601String(),
            ],
            'movements' => $movements,
            'can' => [
                'manage' => $request->user()->can('update', $product),
                'adjustStock' => $request->user()->can('stock.adjust'),
            ],
        ]);
    }

    public function edit(Product $product): Response
    {
        Gate::authorize('update', $product);

        return Inertia::render('products/form', [
            'product' => [
                ...$this->row($product),
                'description' => $product->description,
                'image_url' => $product->imageUrl(),
            ],
            ...$this->formOptions(),
        ]);
    }

    /**
     * Se envía como POST con _method=PUT porque PHP no procesa archivos en PUT.
     */
    public function update(ProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

        $product->update([
            ...collect($data)->except(['image', 'remove_image', 'initial_stock'])->all(),
            'cost' => $data['cost'] ?? 0,
            'is_active' => $request->boolean('is_active'),
        ]);

        if ($request->hasFile('image')) {
            $this->images->replace($product, $request->file('image'));
        } elseif ($request->boolean('remove_image')) {
            $this->images->remove($product);
        }

        $this->activity->log('product.updated', "Se actualizó el producto {$product->code} · {$product->name}.", $product);
        $this->toastSuccess('Producto actualizado.');

        return redirect()->route('products.show', $product);
    }

    public function destroy(Product $product): RedirectResponse
    {
        Gate::authorize('delete', $product);

        // Eliminación lógica: se conserva la imagen y el historial de movimientos.
        $product->delete();

        $this->activity->log('product.deleted', "Se eliminó el producto {$product->code} · {$product->name}.", $product);
        $this->toastSuccess('Producto eliminado.');

        return redirect()->route('products.index');
    }

    /**
     * Ajuste manual de stock: se indica la cantidad contada y el motivo.
     */
    public function adjustStock(Request $request, Product $product): RedirectResponse
    {
        Gate::authorize('view', $product);
        abort_unless($request->user()->can('stock.adjust'), 403);

        $validated = $request->validate([
            'mode' => ['required', 'in:set,add,subtract'],
            'quantity' => ['required', 'numeric', 'min:0', 'max:9999999', 'decimal:0,3'],
            'reason' => ['required', 'string', 'min:3', 'max:200'],
        ], [], ['quantity' => 'cantidad', 'reason' => 'motivo']);

        $quantity = (float) $validated['quantity'];

        $movement = match ($validated['mode']) {
            'set' => $this->stock->adjustTo($product, $quantity, $validated['reason']),
            'add' => $quantity > 0 ? $this->stock->move($product, $quantity, 'in', $validated['reason']) : null,
            'subtract' => $quantity > 0 ? $this->stock->move($product, -$quantity, 'out', $validated['reason']) : null,
        };

        if ($movement === null) {
            return back()->withErrors(['quantity' => 'El stock no cambia con esa cantidad.']);
        }

        $this->activity->log('stock.adjusted', "Ajuste de stock de {$product->code}: {$movement->quantity} ({$validated['reason']}).", $product);
        $this->toastSuccess('Stock actualizado: '.rtrim(rtrim((string) $movement->balance_after, '0'), '.').' '.$product->unit.'.');

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function row(Product $p): array
    {
        return [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'cost' => $p->cost,
            'sale_price' => $p->sale_price,
            'stock' => $p->stock,
            'min_stock' => $p->min_stock,
            'unit' => $p->unit,
            'igv_affectation' => $p->igv_affectation->value,
            'sunat_product_code' => $p->sunat_product_code,
            'is_active' => $p->is_active,
            'is_low_stock' => $p->isLowStock(),
            'thumb_url' => $p->thumbUrl(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'units' => UnitOfMeasure::productOptions(),
            'igvAffectations' => IgvAffectation::options(),
        ];
    }
}
