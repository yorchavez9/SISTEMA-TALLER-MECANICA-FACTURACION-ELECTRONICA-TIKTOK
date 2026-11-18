<?php

namespace App\Policies;

use App\Policies\Concerns\ChecksCompanyPermission;

class ServicePolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'services';
    }
}
