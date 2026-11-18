<?php

namespace App\Http\Controllers\Catalog;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Service;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Búsquedas JSON para los selectores de la OT (y luego de la venta).
 * El global scope multiempresa limita los resultados al taller actual.
 */
class CatalogSearchController extends Controller
{
    public function services(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Service::class);
        $term = trim((string) $request->query('q', ''));

        $items = Service::query()
            ->where('is_active', true)
            ->when($term !== '', fn (Builder $q) => $q->where('name', 'like', "%{$term}%"))
            ->orderBy('name')
            ->limit(20)
            ->get()
            ->map(fn (Service $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'price' => $s->price,
                'unit' => 'ZZ',
                'detail' => $s->description,
            ]);

        return response()->json(['items' => $items]);
    }

    public function products(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);
        $term = trim((string) $request->query('q', ''));

        $items = Product::query()
            ->where('is_active', true)
            ->when($term !== '', fn (Builder $q) => $q->where(fn (Builder $q) => $q
                ->where('name', 'like', "%{$term}%")
                ->orWhere('code', 'like', "{$term}%")))
            ->orderBy('name')
            ->limit(20)
            ->get()
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'code' => $p->code,
                'price' => $p->sale_price,
                'unit' => $p->unit,
                'stock' => $p->stock,
                'thumb_url' => $p->thumbUrl(),
            ]);

        return response()->json(['items' => $items]);
    }

    public function customerVehicles(Customer $customer): JsonResponse
    {
        Gate::authorize('view', $customer);

        $items = $customer->vehicles()->orderBy('plate')->get()->map(fn (Vehicle $v) => [
            'id' => $v->id,
            'plate' => $v->formattedPlate(),
            'description' => trim($v->brand.' '.$v->model.' '.($v->year ?? '')),
            'current_mileage' => $v->current_mileage,
        ]);

        return response()->json(['items' => $items]);
    }
}
