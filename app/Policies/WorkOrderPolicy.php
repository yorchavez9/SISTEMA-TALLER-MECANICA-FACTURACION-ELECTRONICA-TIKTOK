<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkOrder;
use App\Policies\Concerns\ChecksCompanyPermission;

class WorkOrderPolicy
{
    use ChecksCompanyPermission;

    protected function module(): string
    {
        return 'work_orders';
    }

    public function cancel(User $user, WorkOrder $order): bool
    {
        return $user->can('work_orders.cancel') && $this->sameCompany($order);
    }
}
