<?php

namespace App\Enums;

/**
 * Tipo de documento de identidad (cat. 06 SUNAT), igual que "tipo_doc" de la API.
 */
enum IdentityDocumentType: string
{
    case None = '0';
    case Dni = '1';
    case ForeignerCard = '4';
    case Ruc = '6';
    case Passport = '7';
    case DiplomaticId = 'A';

    public function label(): string
    {
        return match ($this) {
            self::None => 'Sin documento',
            self::Dni => 'DNI',
            self::ForeignerCard => 'Carné de extranjería',
            self::Ruc => 'RUC',
            self::Passport => 'Pasaporte',
            self::DiplomaticId => 'Cédula diplomática',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::None => 'S/D',
            self::Dni => 'DNI',
            self::ForeignerCard => 'CE',
            self::Ruc => 'RUC',
            self::Passport => 'PAS',
            self::DiplomaticId => 'CD',
        };
    }

    /**
     * Regla de formato del número.
     */
    public function numberRule(): ?string
    {
        return match ($this) {
            self::None => null,
            self::Dni => '/^\d{8}$/',
            self::Ruc => '/^\d{11}$/',
            self::ForeignerCard, self::Passport, self::DiplomaticId => '/^[A-Z0-9]{4,15}$/',
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
