<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;
use App\Policies\Concerns\ChecksCompanyPermission;

class SalePolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'sales';
    }

    public function void(User $user, Sale $sale): bool
    {
        return $user->can('sales.void') && $this->sameCompany($sale);
    }
}
