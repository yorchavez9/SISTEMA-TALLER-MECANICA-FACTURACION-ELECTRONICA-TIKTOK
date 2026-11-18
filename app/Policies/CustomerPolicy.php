<?php

namespace App\Policies;

use App\Policies\Concerns\ChecksCompanyPermission;

class CustomerPolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'customers';
    }
}
