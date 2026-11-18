<?php

namespace App\Policies\Concerns;

use App\Models\User;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * Autorización por permiso + pertenencia al taller actual. Es la segunda
 * barrera de aislamiento (la primera es el global scope BelongsToCompany).
 * El super admin pasa por Gate::before, pero igualmente solo opera en el
 * taller al que "entró" (el global scope filtra los modelos).
 */
trait ChecksCompanyPermission
{
    abstract protected function module(): string;

    public function viewAny(User $user): bool
    {
        return $user->can($this->module().'.view');
    }

    public function view(User $user, Model $model): bool
    {
        return $user->can($this->module().'.view') && $this->sameCompany($model);
    }

    public function create(User $user): bool
    {
        return $user->can($this->module().'.manage');
    }

    public function update(User $user, Model $model): bool
    {
        return $user->can($this->module().'.manage') && $this->sameCompany($model);
    }

    public function delete(User $user, Model $model): bool
    {
        return $user->can($this->module().'.manage') && $this->sameCompany($model);
    }

    protected function sameCompany(Model $model): bool
    {
        $current = app(CurrentCompany::class)->id();

        return $current !== null && (int) $model->getAttribute('company_id') === $current;
    }
}
