<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;

/**
 * Tipo de detracción (cat. 54) con el porcentaje que eligió el taller.
 *
 * @property int $id
 * @property int $company_id
 * @property string $code
 * @property string $description
 * @property string $rate
 * @property bool $is_active
 * @property bool $is_default
 */
class DetractionType extends Model
{
    use BelongsToCompany;

    /**
     * Lista inicial editable que se siembra en cada taller nuevo. Solo es un
     * punto de partida: el taller debe revisar códigos y porcentajes con su
     * contador.
     *
     * @var list<array{code: string, description: string, rate: float, is_default: bool}>
     */
    public const INITIAL = [
        ['code' => '020', 'description' => 'Mantenimiento y reparación de bienes muebles', 'rate' => 12.00, 'is_default' => true],
        ['code' => '022', 'description' => 'Otros servicios empresariales', 'rate' => 12.00, 'is_default' => false],
        ['code' => '037', 'description' => 'Demás servicios gravados con el IGV', 'rate' => 12.00, 'is_default' => false],
        ['code' => '019', 'description' => 'Arrendamiento de bienes muebles', 'rate' => 10.00, 'is_default' => false],
    ];

    protected $fillable = ['code', 'description', 'rate', 'is_active', 'is_default'];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:2',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
        ];
    }
}
