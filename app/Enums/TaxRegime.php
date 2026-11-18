<?php

namespace App\Enums;

/**
 * Régimen tributario aceptado por la API (PUT /empresa {tax_regime}).
 */
enum TaxRegime: string
{
    case General = 'general';
    case Rer = 'rer';
    case Mype = 'mype';
    case Rus = 'rus';

    public function label(): string
    {
        return match ($this) {
            self::General => 'Régimen General',
            self::Rer => 'Régimen Especial (RER)',
            self::Mype => 'Régimen MYPE Tributario',
            self::Rus => 'Nuevo RUS (solo boletas)',
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $r) => ['value' => $r->value, 'label' => $r->label()], self::cases());
    }
}
