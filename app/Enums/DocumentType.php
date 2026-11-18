<?php

namespace App\Enums;

/**
 * Tipos de comprobante usados por el taller (cat. 01 SUNAT).
 */
enum DocumentType: string
{
    case Invoice = '01';
    case Receipt = '03';
    case CreditNote = '07';
    case DebitNote = '08';

    public function label(): string
    {
        return match ($this) {
            self::Invoice => 'Factura',
            self::Receipt => 'Boleta',
            self::CreditNote => 'Nota de crédito',
            self::DebitNote => 'Nota de débito',
        };
    }

    /** Valor "tipo" que espera POST /series de la API. */
    public function apiSeriesType(): string
    {
        return match ($this) {
            self::Invoice => 'factura',
            self::Receipt => 'boleta',
            self::CreditNote => 'nota_credito',
            self::DebitNote => 'nota_debito',
        };
    }

    /**
     * Regla de formato de la serie: F### (factura), B### (boleta),
     * F/B + 3 caracteres para notas (FC01, BC01, FD01, BD01).
     */
    public function seriesPattern(): string
    {
        return match ($this) {
            self::Invoice => '/^F[A-Z0-9]{3}$/',
            self::Receipt => '/^B[A-Z0-9]{3}$/',
            self::CreditNote, self::DebitNote => '/^[FB][A-Z0-9]{3}$/',
        };
    }

    public function seriesHint(): string
    {
        return match ($this) {
            self::Invoice => 'Debe empezar con F (ej. F001).',
            self::Receipt => 'Debe empezar con B (ej. B001).',
            self::CreditNote => 'Debe empezar con F para facturas o B para boletas (ej. FC01, BC01).',
            self::DebitNote => 'Debe empezar con F para facturas o B para boletas (ej. FD01, BD01).',
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $t) => ['value' => $t->value, 'label' => $t->label()], self::cases());
    }
}
