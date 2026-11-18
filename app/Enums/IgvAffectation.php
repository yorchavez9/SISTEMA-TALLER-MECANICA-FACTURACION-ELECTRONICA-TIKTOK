<?php

namespace App\Enums;

/**
 * Afectación al IGV (cat. 07 SUNAT, "tip_afe_igv" de la API) usada por el taller.
 */
enum IgvAffectation: string
{
    case Taxed = '10';
    case Exempt = '20';
    case Unaffected = '30';

    public function label(): string
    {
        return match ($this) {
            self::Taxed => 'Gravado (IGV)',
            self::Exempt => 'Exonerado',
            self::Unaffected => 'Inafecto',
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $a) => ['value' => $a->value, 'label' => $a->label()], self::cases());
    }
}
