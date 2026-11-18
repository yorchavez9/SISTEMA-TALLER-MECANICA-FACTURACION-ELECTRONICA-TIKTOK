<?php

namespace App\Support\Tenancy;

use App\Models\Company;

/**
 * Empresa (taller) en la que se opera durante la petición actual.
 *
 * La resuelve el middleware EnsureCompanyContext: para usuarios de un taller
 * es siempre su propia empresa; el super admin la elige explícitamente.
 * Registrado como "scoped" (una instancia por petición).
 */
class CurrentCompany
{
    private ?Company $company = null;

    public function set(?Company $company): void
    {
        $this->company = $company;
    }

    public function get(): ?Company
    {
        return $this->company;
    }

    public function id(): ?int
    {
        return $this->company?->id;
    }

    public function has(): bool
    {
        return $this->company !== null;
    }

    public function getOrFail(): Company
    {
        abort_if($this->company === null, 403, 'No hay un taller seleccionado.');

        return $this->company;
    }
}
