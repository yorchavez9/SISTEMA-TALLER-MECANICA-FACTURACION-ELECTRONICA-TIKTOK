<?php

namespace App\Services\Sales;

use App\Models\Company;
use App\Models\DetractionType;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Validation\ValidationException;

/**
 * Detracción (SPOT) dinámica: el taller administra los tipos y porcentajes y
 * el usuario elige el tipo y el % al emitir cada factura (docs §8.8).
 * El monto siempre se recalcula aquí.
 */
class DetractionCalculator
{
    /**
     * Sugerencia para el diálogo de emisión de una venta.
     *
     * @return array{eligible: bool, suggested: bool, reason: string|null, type_id: int|null, rate: string|null, threshold: string, account: string|null, payment_method: string}
     */
    public function suggestion(Sale $sale, Company $company): array
    {
        $settings = $company->billingSettings;
        $threshold = (string) ($settings?->detraction_threshold ?? '700.00');
        $base = [
            'eligible' => false, 'suggested' => false, 'reason' => null, 'type_id' => null, 'rate' => null,
            'threshold' => $threshold, 'account' => $settings?->detraction_account, 'payment_method' => $settings?->detraction_payment_method ?? '001',
        ];

        if ($settings === null || ! $settings->detraction_enabled) {
            return [...$base, 'reason' => 'La detracción está desactivada en la configuración del taller.'];
        }

        $items = $sale->items()->where('subject_to_detraction', true)->get();

        if ($items->isEmpty()) {
            return [...$base, 'reason' => 'La venta no tiene servicios sujetos a detracción.'];
        }

        // Tipo sugerido: el del servicio de mayor importe; si no tiene, el predeterminado.
        /** @var SaleItem|null $main */
        $main = $items->sortByDesc(fn (SaleItem $i) => (float) $i->total)->first();
        $type = ($main?->detraction_type_id ? DetractionType::query()->where('is_active', true)->find($main->detraction_type_id) : null)
            ?? DetractionType::query()->where('is_active', true)->where('is_default', true)->first()
            ?? DetractionType::query()->where('is_active', true)->orderBy('code')->first();

        $suggested = (float) $sale->total > (float) $threshold;

        return [
            ...$base,
            'eligible' => true,
            'suggested' => $suggested,
            'reason' => $suggested ? null : 'El total no supera el monto mínimo configurado (S/ '.$threshold.').',
            'type_id' => $type?->id,
            'rate' => $type?->rate,
        ];
    }

    /**
     * Valida la elección del usuario y arma el bloque "detraccion" de la API.
     *
     * @param  array{apply: bool, type_id?: int|null, rate?: float|string|null, override_reason?: string|null}  $choice
     * @return array{block: array<string, mixed>|null, snapshot: array<string, mixed>}
     */
    public function resolve(Sale $sale, Company $company, array $choice, bool $suggested): array
    {
        $settings = $company->billingSettings;

        if (! $choice['apply']) {
            if ($suggested && blank($choice['override_reason'] ?? null)) {
                throw ValidationException::withMessages([
                    'detraction.override_reason' => 'Indique el motivo para no aplicar la detracción sugerida.',
                ]);
            }

            return ['block' => null, 'snapshot' => ['detraction_override_reason' => $suggested ? $choice['override_reason'] : null]];
        }

        $type = DetractionType::query()->where('is_active', true)->find($choice['type_id'] ?? 0);

        if ($type === null) {
            throw ValidationException::withMessages(['detraction.type_id' => 'Elija un tipo de detracción válido del taller.']);
        }

        $rate = (float) ($choice['rate'] ?? $type->rate);

        if ($rate <= 0 || $rate > 100) {
            throw ValidationException::withMessages(['detraction.rate' => 'El porcentaje debe ser mayor que 0 y como máximo 100.']);
        }

        if (blank($settings?->detraction_account)) {
            throw ValidationException::withMessages([
                'detraction.type_id' => 'Configure la cuenta de detracciones del Banco de la Nación en Configuración del taller → Detracción.',
            ]);
        }

        $amount = round((float) $sale->total * $rate / 100, 2);

        $block = [
            'tipo_operacion' => '1001',
            'cod_bien' => $type->code,
            'cod_medio_pago' => $settings->detraction_payment_method,
            'cta_banco' => $settings->detraction_account,
            'porcentaje' => round($rate, 2),
            'monto' => $amount,
        ];

        return [
            'block' => $block,
            'snapshot' => [
                'detraction_code' => $type->code,
                'detraction_rate' => round($rate, 2),
                'detraction_amount' => $amount,
                'detraction_account' => $settings->detraction_account,
                'detraction_payment_method' => $settings->detraction_payment_method,
                // Se registra si el usuario cambió el % del tipo.
                'detraction_override_reason' => abs($rate - (float) $type->rate) > 0.001
                    ? 'Porcentaje modificado al emitir ('.$type->rate.' % → '.round($rate, 2).' %)'
                    : null,
            ],
        ];
    }
}
