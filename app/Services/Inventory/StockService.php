<?php

namespace App\Services\Inventory;

use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Único punto que modifica el stock. Cada cambio queda como movimiento
 * (kardex) con el saldo resultante. La fila del producto se bloquea para que
 * dos operaciones simultáneas no pierdan unidades.
 */
class StockService
{
    /**
     * Registra un movimiento con cantidad con signo (+ entra, − sale).
     */
    public function move(Product $product, float $quantity, string $type, string $reason, ?Model $source = null): StockMovement
    {
        if (! array_key_exists($type, StockMovement::TYPES)) {
            throw new InvalidArgumentException("Tipo de movimiento no válido: {$type}");
        }

        if (abs($quantity) < 0.0005) {
            throw new InvalidArgumentException('La cantidad del movimiento no puede ser cero.');
        }

        return DB::transaction(function () use ($product, $quantity, $type, $reason, $source): StockMovement {
            /** @var Product $locked */
            $locked = Product::query()->withoutGlobalScopes()->whereKey($product->id)->lockForUpdate()->firstOrFail();

            $balance = round((float) $locked->stock + $quantity, 3);
            $locked->forceFill(['stock' => $balance])->save();

            $movement = new StockMovement([
                'product_id' => $locked->id,
                'type' => $type,
                'quantity' => round($quantity, 3),
                'balance_after' => $balance,
                'reason' => $reason,
                'user_id' => auth()->id(),
            ]);
            $movement->company_id = $locked->company_id;

            if ($source !== null) {
                $movement->source()->associate($source);
            }

            $movement->save();

            $product->stock = $locked->stock;

            return $movement;
        });
    }

    /**
     * Ajuste manual: deja el stock en la cantidad contada.
     */
    public function adjustTo(Product $product, float $countedQuantity, string $reason): ?StockMovement
    {
        $current = (float) Product::query()->withoutGlobalScopes()->whereKey($product->id)->value('stock');
        $difference = round($countedQuantity - $current, 3);

        if (abs($difference) < 0.0005) {
            return null;
        }

        return $this->move($product, $difference, 'adjust', $reason);
    }
}
