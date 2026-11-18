<?php

namespace App\Services\SunatApi;

use App\Enums\DocumentType;
use App\Models\Customer;
use App\Models\ElectronicDocument;
use App\Models\Sale;
use App\Models\SaleItem;

/**
 * Construye los payloads exactamente con los campos de la colección Postman
 * (POST /facturas, /boletas, /notas-credito). Los precios van con IGV
 * (precio_unitario), igual que en los ejemplos de la API.
 */
class DocumentPayloadBuilder
{
    /**
     * @param  array<string, mixed>|null  $detraction  Bloque "detraccion" ya resuelto.
     * @return array<string, mixed>
     */
    public function forSale(Sale $sale, DocumentType $type, string $series, int $number, string $issueDate, ?array $detraction, bool $nrus = false): array
    {
        $payload = [
            'serie' => $series,
            'correlativo' => $number,
            'fecha_emision' => $issueDate,
            'tipo_moneda' => $sale->currency,
            'forma_pago' => 'Contado',
            'cliente' => $this->customer($sale->customer),
            'items' => $sale->items->map(fn (SaleItem $item) => $this->item($item))->values()->all(),
            'enviar_automatico' => true,
        ];

        // NRUS: la API fija tipo_operacion 0113 automáticamente.
        if (! $nrus) {
            $payload['tipo_operacion'] = '0101';
        }

        if ($type === DocumentType::Receipt) {
            // Envío individual (no por resumen diario).
            $payload['solo_registro'] = false;
        }

        if ($detraction !== null) {
            $payload['detraccion'] = $detraction;
        }

        return $payload;
    }

    /**
     * Nota de crédito por anulación total (cat. 09, motivo 01) del comprobante.
     *
     * @return array<string, mixed>
     */
    public function creditNote(ElectronicDocument $original, string $series, int $number, string $issueDate, string $reasonCode, string $reasonDescription): array
    {
        /** @var Sale $sale */
        $sale = $original->sale;

        return [
            'serie' => $series,
            'correlativo' => $number,
            'fecha_emision' => $issueDate,
            'tipo_moneda' => $original->currency,
            'doc_afectado_tipo' => $original->document_type->value,
            'doc_afectado_serie' => $original->series,
            'doc_afectado_correlativo' => (string) $original->number,
            'cod_motivo' => $reasonCode,
            'des_motivo' => $reasonDescription,
            // Mismo receptor que el comprobante original (instantánea).
            'cliente' => array_filter([
                'tipo_doc' => $original->customer_document_type,
                'num_doc' => $original->customer_document_number ?? '99999999',
                'razon_social' => $original->customer_name,
                'direccion' => $original->customer_address,
            ], fn ($v) => $v !== null && $v !== ''),
            'items' => $sale->items->map(fn (SaleItem $item) => $this->item($item))->values()->all(),
            'enviar_automatico' => true,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function customer(Customer $customer): array
    {
        $hasDocument = $customer->document_type->value !== '0' && filled($customer->document_number);

        return array_filter([
            'tipo_doc' => $customer->document_type->value,
            // Consumidor final sin documento (solo boletas < S/ 700), como en la colección.
            'num_doc' => $hasDocument ? $customer->document_number : '99999999',
            'razon_social' => $customer->name,
            'direccion' => $customer->address,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * @return array<string, mixed>
     */
    private function item(SaleItem $item): array
    {
        return array_filter([
            'codigo' => $item->code,
            'cod_producto_sunat' => $item->sunat_product_code,
            'descripcion' => $item->description,
            'unidad' => $item->unit,
            'cantidad' => (float) $item->quantity,
            'precio_unitario' => (float) $item->unit_price,
            'tip_afe_igv' => $item->igv_affectation->value,
        ], fn ($v) => $v !== null && $v !== '');
    }
}
