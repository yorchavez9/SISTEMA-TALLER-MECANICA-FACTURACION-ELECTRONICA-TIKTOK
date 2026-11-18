<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Fila única (id = 1) con el estado de instalación del sistema.
 *
 * @property int $id
 * @property Carbon|null $installed_at
 * @property int|null $installed_by_user_id
 */
class SystemSetting extends Model
{
    public const SINGLETON_ID = 1;

    public $incrementing = false;

    protected $fillable = ['installed_at', 'installed_by_user_id'];

    protected function casts(): array
    {
        return [
            'installed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function installedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'installed_by_user_id');
    }
}
