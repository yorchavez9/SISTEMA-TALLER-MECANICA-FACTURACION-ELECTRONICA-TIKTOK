<?php

namespace App\Policies;

use App\Policies\Concerns\ChecksCompanyPermission;

class VehiclePolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'vehicles';
    }
}
