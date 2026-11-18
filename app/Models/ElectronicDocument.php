<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $company_id
 * @property int|null $sale_id
 * @property int|null $related_document_id
 * @property int|null $document_series_id
 * @property DocumentType $document_type
 * @property string $series
 * @property int $number
 * @property Carbon $issue_date
 * @property string $currency
 * @property string $taxable_amount
 * @property string $igv
 * @property string $total
 * @property string $customer_document_type
 * @property string|null $customer_document_number
 * @property string $customer_name
 * @property string|null $customer_address
 * @property string $issuer_ruc
 * @property string $issuer_name
 * @property string|null $issuer_address
 * @property string|null $establishment_code
 * @property string $environment
 * @property string|null $reason_code
 * @property string|null $reason_description
 * @property string|null $detraction_code
 * @property string|null $detraction_rate
 * @property string|null $detraction_amount
 * @property string|null $detraction_account
 * @property string|null $detraction_payment_method
 * @property string|null $detraction_override_reason
 * @property string|null $issuance_key
 * @property int|null $api_document_id
 * @property string|null $api_status
 * @property DocumentStatus $local_status
 * @property string|null $sunat_code
 * @property string|null $sunat_message
 * @property string|null $last_error
 * @property array<string, mixed> $request_payload
 * @property array<string, mixed>|null $last_response
 * @property Carbon|null $sent_at
 * @property Carbon|null $accepted_at
 * @property Carbon|null $last_checked_at
 * @property Carbon|null $next_check_at
 * @property int $check_attempts
 * @property string|null $xml_path
 * @property string|null $cdr_path
 * @property-read Sale|null $sale
 * @property-read ElectronicDocument|null $relatedDocument
 */
class ElectronicDocument extends Model
{
    use BelongsToCompany;

    /**
     * Todo se asigna explícitamente en DocumentIssuer (no hay asignación masiva desde formularios).
     *
     * @var list<string>
     */
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'local_status' => DocumentStatus::class,
            'issue_date' => 'date',
            'taxable_amount' => 'decimal:2',
            'igv' => 'decimal:2',
            'total' => 'decimal:2',
            'detraction_rate' => 'decimal:2',
            'detraction_amount' => 'decimal:2',
            'request_payload' => 'array',
            'last_response' => 'array',
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'last_checked_at' => 'datetime',
            'next_check_at' => 'datetime',
        ];
    }

    public function fullNumber(): string
    {
        return $this->series.'-'.$this->number;
    }

    /**
     * Ruta de la API para este tipo de comprobante.
     */
    public function apiResource(): string
    {
        return match ($this->document_type) {
            DocumentType::Invoice => 'facturas',
            DocumentType::Receipt => 'boletas',
            DocumentType::CreditNote => 'notas-credito',
            DocumentType::DebitNote => 'notas-debito',
        };
    }

    /**
     * @return BelongsTo<Sale, $this>
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /**
     * Comprobante afectado (para NC/ND).
     *
     * @return BelongsTo<ElectronicDocument, $this>
     */
    public function relatedDocument(): BelongsTo
    {
        return $this->belongsTo(self::class, 'related_document_id');
    }

    /**
     * Notas emitidas sobre este comprobante.
     *
     * @return HasMany<ElectronicDocument, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(self::class, 'related_document_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
