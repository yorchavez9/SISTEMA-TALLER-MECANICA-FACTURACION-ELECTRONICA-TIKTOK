<?php

namespace App\Models;

use App\Enums\IdentityDocumentType;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $company_id
 * @property IdentityDocumentType $document_type
 * @property string|null $document_number
 * @property string $name
 * @property string|null $trade_name
 * @property string|null $address
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $notes
 */
class Customer extends Model
{
    /** @use HasFactory<\Database\Factories\CustomerFactory> */
    use BelongsToCompany, HasFactory, SoftDeletes;

    protected $fillable = ['document_type', 'document_number', 'name', 'trade_name', 'address', 'phone', 'email', 'notes'];

    protected function casts(): array
    {
        return ['document_type' => IdentityDocumentType::class];
    }

    public function documentLabel(): string
    {
        return $this->document_number
            ? $this->document_type->shortLabel().' '.$this->document_number
            : $this->document_type->label();
    }

    /**
     * @return HasMany<Vehicle, $this>
     */
    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }
}
