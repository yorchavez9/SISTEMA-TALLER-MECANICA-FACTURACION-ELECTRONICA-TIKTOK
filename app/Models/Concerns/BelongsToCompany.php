<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aislamiento multiempresa.
 *
 * - Si hay una empresa actual, todas las consultas se filtran por su company_id.
 * - Al crear, company_id se completa con la empresa actual.
 *
 * Es la primera barrera; las policies vuelven a comprobar company_id.
 *
 * @property int $company_id
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope('company', function (Builder $builder): void {
            $companyId = app(CurrentCompany::class)->id();

            if ($companyId !== null) {
                $builder->where($builder->getModel()->qualifyColumn('company_id'), $companyId);
            }
        });

        static::creating(function ($model): void {
            if (empty($model->company_id)) {
                $model->company_id = app(CurrentCompany::class)->id();
            }
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
