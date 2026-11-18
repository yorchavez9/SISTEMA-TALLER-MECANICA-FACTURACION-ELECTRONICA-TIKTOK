<?php

namespace App\Enums;

/**
 * Unidades de medida frecuentes en un taller (cat. 03 SUNAT, "unidad" de la API).
 * Los servicios siempre usan ZZ.
 */
enum UnitOfMeasure: string
{
    case Unit = 'NIU';
    case Liter = 'LTR';
    case Gallon = 'GLL';
    case Kilogram = 'KGM';
    case Meter = 'MTR';
    case Set = 'SET';
    case Pair = 'PR';
    case Box = 'BX';
    case Service = 'ZZ';

    public function label(): string
    {
        return match ($this) {
            self::Unit => 'Unidad (NIU)',
            self::Liter => 'Litro (LTR)',
            self::Gallon => 'Galón (GLL)',
            self::Kilogram => 'Kilogramo (KGM)',
            self::Meter => 'Metro (MTR)',
            self::Set => 'Juego (SET)',
            self::Pair => 'Par (PR)',
            self::Box => 'Caja (BX)',
            self::Service => 'Servicio (ZZ)',
        };
    }

    /**
     * Unidades válidas para productos (sin ZZ).
     *
     * @return list<array{value: string, label: string}>
     */
    public static function productOptions(): array
    {
        return array_values(array_map(
            fn (self $u) => ['value' => $u->value, 'label' => $u->label()],
            array_filter(self::cases(), fn (self $u) => $u !== self::Service),
        ));
    }
}
