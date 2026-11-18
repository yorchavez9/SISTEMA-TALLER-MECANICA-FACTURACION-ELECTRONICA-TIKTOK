<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    case CompanyAdmin = 'company_admin';
    case Cashier = 'cashier';
    case Mechanic = 'mechanic';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super administrador',
            self::CompanyAdmin => 'Administrador del taller',
            self::Cashier => 'Caja / recepción',
            self::Mechanic => 'Técnico',
        };
    }
}
