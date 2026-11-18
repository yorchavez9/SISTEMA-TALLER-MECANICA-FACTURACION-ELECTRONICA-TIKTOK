<?php

namespace App\Services\Sales;

use App\Enums\IgvAffectation;
use App\Models\Company;

/**
 * Cálculo de importes con precios que INCLUYEN IGV (igual que
 * "precio_unitario" de la API SUNAT): total = cantidad × precio; para ítems
 * gravados la base es total / (1 + tasa) y el IGV es la diferencia.
 *
 * Los totales oficiales del comprobante los calcula la API; estos son los
 * del sistema (OT y venta) y se redondean a 2 decimales por línea.
 */
class TaxCalculator
{
    public const DEFAULT_IGV_RATE = 18.0;

    /**
     * Tasa de IGV vigente del taller (la informada por la API, la forzada por
     * el super admin o 18 %).
     */
    public function rateFor(?Company $company): float
    {
        $settings = $company?->billingSettings;

        if ($settings?->igv_rate_override !== null) {
            return (float) $settings->igv_rate_override;
        }

        if ($settings?->igv_rate !== null) {
            return (float) $settings->igv_rate;
        }

        return self::DEFAULT_IGV_RATE;
    }

    /**
     * @return array{subtotal: float, igv: float, total: float}
     */
    public function line(float $quantity, float $unitPrice, IgvAffectation $affectation, float $rate): array
    {
        $total = round($quantity * $unitPrice, 2);

        if ($affectation !== IgvAffectation::Taxed || $rate <= 0) {
            return ['subtotal' => $total, 'igv' => 0.0, 'total' => $total];
        }

        $subtotal = round($total / (1 + $rate / 100), 2);

        return ['subtotal' => $subtotal, 'igv' => round($total - $subtotal, 2), 'total' => $total];
    }

    /**
     * @param  iterable<array{subtotal: float|string, igv: float|string, total: float|string}>  $lines
     * @return array{subtotal: float, igv: float, total: float}
     */
    public function sum(iterable $lines): array
    {
        $sum = ['subtotal' => 0.0, 'igv' => 0.0, 'total' => 0.0];

        foreach ($lines as $line) {
            $sum['subtotal'] += (float) $line['subtotal'];
            $sum['igv'] += (float) $line['igv'];
            $sum['total'] += (float) $line['total'];
        }

        return array_map(fn (float $v) => round($v, 2), $sum);
    }
}
