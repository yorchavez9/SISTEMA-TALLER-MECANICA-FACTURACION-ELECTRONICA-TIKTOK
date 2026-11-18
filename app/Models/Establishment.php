<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Establecimiento (sucursal) del taller. cod_local "0000" = principal.
 *
 * @property int $id
 * @property int $company_id
 * @property int|null $api_branch_id
 * @property string $name
 * @property string $local_code
 * @property string $address
 * @property string $ubigeo
 * @property string|null $phone
 * @property string|null $email
 * @property bool $is_main
 */
class Establishment extends Model
{
    use BelongsToCompany;

    protected $fillable = ['name', 'local_code', 'address', 'ubigeo', 'phone', 'email', 'is_main'];

    protected function casts(): array
    {
        return ['is_main' => 'boolean'];
    }

    /**
     * @return HasMany<DocumentSeries, $this>
     */
    public function series(): HasMany
    {
        return $this->hasMany(DocumentSeries::class);
    }
}
