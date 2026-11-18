<?php

namespace App\Policies;

use App\Policies\Concerns\ChecksCompanyPermission;

class ProductPolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'products';
    }
}
