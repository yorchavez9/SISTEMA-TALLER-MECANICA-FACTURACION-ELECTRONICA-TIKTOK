<?php

namespace App\Services\SunatApi;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\IdentityDocumentType;
use App\Models\Company;
use App\Models\DocumentSeries;
use App\Models\ElectronicDocument;
use App\Models\Sale;
use App\Services\Audit\ActivityLogger;
use App\Services\Sales\DetractionCalculator;
use App\Services\Sales\SaleService;
use App\Services\SunatApi\Exceptions\ApiAuthException;
use App\Services\SunatApi\Exceptions\ApiConnectionException;
use App\Services\SunatApi\Exceptions\ApiNotConfiguredException;
use App\Services\SunatApi\Exceptions\ApiServerException;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Emisión de comprobantes contra la API SUNAT PRO, SIN colas: Laravel hace la
 * solicitud HTTP y la API procesa el envío a SUNAT internamente.
 *
 * Protección contra duplicados (docs §8.4):
 *  1. issuance_key UNIQUE: una venta tiene un único comprobante vigente.
 *  2. Bloqueo de la venta y de la serie; el correlativo se reserva localmente
 *     y se envía explícito → cada intento tiene un "serie-número" verificable.
 *  3. La solicitud HTTP se hace FUERA de la transacción.
 *  4. Un POST nunca se reintenta automáticamente. Ante timeout o 5xx el
 *     comprobante queda "Sin confirmar" y se VERIFICA (GET por serie y
 *     número) antes de permitir un reintento con el mismo correlativo.
 */
class DocumentIssuer
{
    /** Antigüedad mínima para concluir que un envío sin confirmar no llegó a la API. */
    private const UNKNOWN_GRACE_SECONDS = 120;

    public function __construct(
        private readonly DocumentPayloadBuilder $payloads,
        private readonly DetractionCalculator $detraction,
        private readonly SaleService $sales,
        private readonly ActivityLogger $activity,
    ) {}

    /**
     * @param  array{apply: bool, type_id?: int|null, rate?: float|string|null, override_reason?: string|null}|null  $detractionChoice
     */
    public function issue(Sale $sale, DocumentType $type, ?int $seriesId, ?array $detractionChoice = null): ElectronicDocument
    {
        if (! in_array($type, [DocumentType::Invoice, DocumentType::Receipt], true)) {
            throw ValidationException::withMessages(['document_type' => 'Desde una venta solo se emite factura o boleta.']);
        }

        $document = DB::transaction(function () use ($sale, $type, $seriesId, $detractionChoice): ElectronicDocument {
            /** @var Sale $locked */
            $locked = Sale::query()->whereKey($sale->id)->lockForUpdate()->firstOrFail();
            $locked->load(['customer', 'items']);
            $company = Company::query()->with('billingSettings')->findOrFail($locked->company_id);

            $this->ensureCanIssue($locked, $company, $type);

            $detraction = ['block' => null, 'snapshot' => []];
            if ($type === DocumentType::Invoice) {
                $suggestion = $this->detraction->suggestion($locked, $company);
                if ($suggestion['eligible'] || ($detractionChoice['apply'] ?? false)) {
                    $detraction = $this->detraction->resolve($locked, $company, $detractionChoice ?? ['apply' => false], $suggestion['suggested']);
                }
            }

            $series = $this->lockSeries($company, $type, $seriesId);
            $number = $series->last_number + 1;
            $series->forceFill(['last_number' => $number])->save();

            $issueDate = now()->toDateString();
            $nrus = $company->billingSettings->tax_regime === 'rus';
            $payload = $this->payloads->forSale($locked, $type, $series->series, $number, $issueDate, $detraction['block'], $nrus);

            $document = new ElectronicDocument;
            $document->forceFill([
                'company_id' => $company->id,
                'sale_id' => $locked->id,
                'document_series_id' => $series->id,
                'document_type' => $type,
                'series' => $series->series,
                'number' => $number,
                'issue_date' => $issueDate,
                'currency' => $locked->currency,
                'taxable_amount' => $locked->subtotal,
                'igv' => $locked->igv,
                'total' => $locked->total,
                ...$this->customerSnapshot($locked),
                ...$this->issuerSnapshot($company, $series),
                ...$detraction['snapshot'],
                'issuance_key' => 'sale:'.$locked->id,
                'local_status' => DocumentStatus::Sending,
                'request_payload' => $payload,
                'created_by' => auth()->id(),
            ])->save();

            return $document;
        });

        $this->activity->log('document.issuing', "Emitiendo {$type->label()} {$document->fullNumber()} de la venta {$sale->code()}.", $document);

        return $this->send($document);
    }

    /**
     * Nota de crédito de anulación total (motivo 01) de un comprobante aceptado.
     */
    public function creditNote(ElectronicDocument $original, string $description): ElectronicDocument
    {
        $note = DB::transaction(function () use ($original, $description): ElectronicDocument {
            /** @var ElectronicDocument $locked */
            $locked = ElectronicDocument::query()->whereKey($original->id)->lockForUpdate()->firstOrFail();
            $locked->load('sale.items', 'sale.customer');
            $company = Company::query()->with('billingSettings')->findOrFail($locked->company_id);

            if (! in_array($locked->document_type, [DocumentType::Invoice, DocumentType::Receipt], true)) {
                throw ValidationException::withMessages(['credit_note' => 'Solo se puede emitir nota de crédito sobre facturas o boletas.']);
            }

            if ($locked->local_status !== DocumentStatus::Accepted) {
                throw ValidationException::withMessages(['credit_note' => 'El comprobante debe estar aceptado por SUNAT para anularlo con nota de crédito.']);
            }

            if ($company->billingSettings->tax_regime === 'rus') {
                throw ValidationException::withMessages(['credit_note' => 'El régimen Nuevo RUS no permite emitir notas de crédito.']);
            }

            $this->ensureCompanyReady($company);

            // Serie de NC que corresponde al comprobante: F… para facturas, B… para boletas.
            $prefix = substr($locked->series, 0, 1);
            $series = DocumentSeries::query()
                ->withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->where('document_type', DocumentType::CreditNote->value)
                ->where('is_active', true)
                ->where('series', 'like', $prefix.'%')
                ->orderBy('series')
                ->lockForUpdate()
                ->first();

            if ($series === null) {
                throw ValidationException::withMessages(['credit_note' => "No hay una serie activa de nota de crédito que empiece con {$prefix} (ej. {$prefix}C01). Créela en Configuración del taller → Series."]);
            }

            $number = $series->last_number + 1;
            $series->forceFill(['last_number' => $number])->save();
            $issueDate = now()->toDateString();

            $note = new ElectronicDocument;
            $note->forceFill([
                'company_id' => $company->id,
                'sale_id' => $locked->sale_id,
                'related_document_id' => $locked->id,
                'document_series_id' => $series->id,
                'document_type' => DocumentType::CreditNote,
                'series' => $series->series,
                'number' => $number,
                'issue_date' => $issueDate,
                'currency' => $locked->currency,
                'taxable_amount' => $locked->taxable_amount,
                'igv' => $locked->igv,
                'total' => $locked->total,
                'customer_document_type' => $locked->customer_document_type,
                'customer_document_number' => $locked->customer_document_number,
                'customer_name' => $locked->customer_name,
                'customer_address' => $locked->customer_address,
                ...$this->issuerSnapshot($company, $series),
                'reason_code' => '01',
                'reason_description' => $description,
                // Una sola NC vigente por comprobante.
                'issuance_key' => 'nc:'.$locked->id,
                'local_status' => DocumentStatus::Sending,
                'request_payload' => $this->payloads->creditNote($locked, $series->series, $number, $issueDate, '01', $description),
                'created_by' => auth()->id(),
            ])->save();

            return $note;
        });

        $this->activity->log('document.credit_note', "Emitiendo nota de crédito {$note->fullNumber()} que anula {$original->fullNumber()}.", $note);

        return $this->send($note);
    }

    /**
     * Consulta el estado en la API (GET /{tipo}/{id}). Solo lectura.
     */
    public function refresh(ElectronicDocument $document): ElectronicDocument
    {
        if ($document->local_status === DocumentStatus::Unknown || $document->api_document_id === null) {
            return $this->verify($document);
        }

        try {
            $response = $this->client($document)->get($document->apiResource().'/'.$document->api_document_id, operation: 'document_status');
            $this->apply($document, $response->datos ?? [], $response->raw);
        } catch (SunatApiException $e) {
            $this->scheduleNextCheck($document, $e->userMessage());

            throw $e;
        }

        return $document;
    }

    /**
     * Tras un timeout o 5xx: busca el comprobante por serie y número. Solo
     * lectura; nunca crea nada.
     */
    public function verify(ElectronicDocument $document): ElectronicDocument
    {
        $response = $this->client($document)->get($document->apiResource(), [
            'serie' => $document->series,
            'correlativo' => $document->number,
        ], 'document_verify');

        $found = collect($this->listOf($response->datos ?? []))
            ->first(fn ($row) => is_array($row) && (string) ($row['serie'] ?? $document->series) === $document->series
                && (int) ($row['correlativo'] ?? $row['numero'] ?? $document->number) === $document->number);

        if (is_array($found)) {
            $this->apply($document, $found, $response->raw);
            $this->activity->log('document.verified', "Verificado en la API: {$document->fullNumber()} sí fue registrado.", $document);

            return $document;
        }

        // No está en la API: solo se concluye si pasó un margen prudente.
        if ($document->created_at !== null && $document->created_at->diffInSeconds(now()) >= self::UNKNOWN_GRACE_SECONDS) {
            $document->forceFill([
                'local_status' => DocumentStatus::Failed,
                'last_error' => 'Verificado: el comprobante no llegó a registrarse en la API. Puede reintentar el envío con el mismo número.',
                'last_checked_at' => now(),
            ])->save();
        } else {
            $this->scheduleNextCheck($document, 'Aún no aparece en la API; se volverá a verificar en unos minutos.');
        }

        return $document;
    }

    /**
     * Reintenta el envío de un comprobante que la API NO registró (estado
     * "No registrado"). Usa el mismo número y actualiza los datos del cliente
     * por si fueron corregidos.
     */
    public function retry(ElectronicDocument $document): ElectronicDocument
    {
        if ($document->local_status !== DocumentStatus::Failed) {
            throw ValidationException::withMessages(['document' => 'Solo se reintentan comprobantes que no se registraron en la API. Si está "Sin confirmar", verifique primero.']);
        }

        if ($document->sale_id !== null && in_array($document->document_type, [DocumentType::Invoice, DocumentType::Receipt], true)) {
            $sale = Sale::query()->with('customer')->findOrFail($document->sale_id);
            $this->ensureCustomerFits($sale, $document->document_type);
            $payload = $document->request_payload;
            $payload['cliente'] = $this->payloads->forSale($sale->load('items'), $document->document_type, $document->series, $document->number, $document->issue_date->toDateString(), null)['cliente'];
            $document->forceFill(['request_payload' => $payload, ...$this->customerSnapshot($sale)]);
        }

        $document->forceFill(['local_status' => DocumentStatus::Sending, 'last_error' => null])->save();

        return $this->send($document);
    }

    /**
     * Reenvía a SUNAT un comprobante pendiente o rechazado (POST /{tipo}/{id}/enviar).
     * La API rechaza la llamada si ya fue aceptado, así que no duplica.
     */
    public function resend(ElectronicDocument $document): ElectronicDocument
    {
        if (! in_array($document->local_status, [DocumentStatus::Pending, DocumentStatus::Rejected], true) || $document->api_document_id === null) {
            throw ValidationException::withMessages(['document' => 'Solo se reenvían comprobantes pendientes o rechazados.']);
        }

        $response = $this->client($document)->post($document->apiResource().'/'.$document->api_document_id.'/enviar', [], 'document_resend');
        $this->apply($document, $response->datos ?? [], $response->raw, DocumentStatus::Sent);

        return $document;
    }

    /**
     * Descarta un comprobante que nunca se registró en la API, para emitir otro
     * tipo (p. ej. boleta en vez de factura). Si era el último número de su
     * serie, se libera el correlativo.
     */
    public function discard(ElectronicDocument $document): void
    {
        if ($document->local_status !== DocumentStatus::Failed) {
            throw ValidationException::withMessages(['document' => 'Solo se descartan comprobantes que no se registraron en la API.']);
        }

        DB::transaction(function () use ($document): void {
            $series = $document->document_series_id
                ? DocumentSeries::query()->withoutGlobalScopes()->whereKey($document->document_series_id)->lockForUpdate()->first()
                : null;

            if ($series !== null && $series->last_number === $document->number) {
                $series->forceFill(['last_number' => $document->number - 1])->save();
                $document->delete();
            } else {
                // Número intermedio: se conserva como registro, liberando la venta.
                $document->forceFill(['issuance_key' => null])->save();
            }
        });

        $this->activity->log('document.discarded', "Se descartó el intento {$document->fullNumber()} (no registrado en la API).", $document->sale);
    }

    // ------------------------------------------------------------------ envío

    private function send(ElectronicDocument $document): ElectronicDocument
    {
        $document->forceFill(['sent_at' => now()])->save();

        try {
            $response = $this->client($document)->post($document->apiResource(), $document->request_payload, 'issue_'.$document->apiResource());
            $this->apply($document, $response->datos ?? [], $response->raw, DocumentStatus::Sent);
        } catch (ApiConnectionException|ApiServerException $e) {
            // Puede haberse registrado: NUNCA reintentar sin verificar.
            $this->markUnknown($document, $e->userMessage());
        } catch (ApiNotConfiguredException|ApiAuthException $e) {
            $this->markFailed($document, $e->userMessage());
        } catch (SunatApiException $e) {
            if (preg_match('/exist|duplic|ya fue registrad|ya se encuentra/i', $e->userMessage())) {
                // La API indica que el número ya existe: se adopta tras verificar.
                $this->markUnknown($document, $e->userMessage());

                try {
                    $this->verify($document);
                } catch (SunatApiException) {
                    // Queda "Sin confirmar"; la tarea programada volverá a verificar.
                }
            } else {
                $this->markFailed($document, $e->userMessage());
            }
        }

        return $document->fresh() ?? $document;
    }

    /**
     * Aplica la respuesta de la API al comprobante. Los nombres de campo no
     * están documentados en la colección; se leen de forma tolerante.
     *
     * @param  array<mixed>  $datos
     * @param  array<string, mixed>  $raw
     */
    private function apply(ElectronicDocument $document, array $datos, array $raw, ?DocumentStatus $default = null): void
    {
        $response = new ApiResponse(200, $raw['estado'] ?? null, $raw['mensaje'] ?? null, $datos, null, $raw);

        $id = $response->find('id');
        $apiStatus = $response->find('sunat_status', 'estado_sunat', 'status_sunat', 'estado_cpe', 'status');
        $status = DocumentStatus::fromApi(is_string($apiStatus) ? $apiStatus : null) ?? $default ?? $document->local_status;
        $code = $response->find('sunat_code', 'codigo_sunat', 'cdr_code', 'cdr_codigo', 'sunat_response_code');
        $message = $response->find('sunat_description', 'sunat_message', 'descripcion_sunat', 'mensaje_sunat', 'cdr_description', 'cdr_descripcion', 'sunat_observaciones');

        $wasAccepted = $document->local_status === DocumentStatus::Accepted;

        $document->forceFill([
            'api_document_id' => is_numeric($id) ? (int) $id : $document->api_document_id,
            'api_status' => is_string($apiStatus) ? mb_substr($apiStatus, 0, 20) : $document->api_status,
            'local_status' => $status,
            'sunat_code' => is_scalar($code) ? mb_substr((string) $code, 0, 20) : $document->sunat_code,
            'sunat_message' => is_string($message) ? $message : (is_array($message) ? implode(' ', array_map('strval', array_filter($message, 'is_scalar'))) : $document->sunat_message),
            'last_error' => null,
            'last_response' => LogSanitizer::sanitize($raw),
            'accepted_at' => $status === DocumentStatus::Accepted ? ($document->accepted_at ?? now()) : $document->accepted_at,
            'last_checked_at' => now(),
        ]);

        if ($status->needsStatusCheck()) {
            $document->forceFill([
                'check_attempts' => $document->check_attempts + 1,
                'next_check_at' => now()->addMinutes(min(2 ** min($document->check_attempts, 6), 60)),
            ]);
        } else {
            $document->forceFill(['next_check_at' => null]);
        }

        $document->save();

        if (! $wasAccepted && $status === DocumentStatus::Accepted) {
            $this->onAccepted($document);
        }
    }

    /**
     * Una NC de anulación aceptada anula el comprobante original y la venta
     * (devolviendo el stock).
     */
    private function onAccepted(ElectronicDocument $document): void
    {
        $this->activity->log('document.accepted', "SUNAT aceptó {$document->document_type->label()} {$document->fullNumber()}.", $document);

        if ($document->document_type !== DocumentType::CreditNote || $document->reason_code !== '01' || $document->related_document_id === null) {
            return;
        }

        $original = ElectronicDocument::query()->withoutGlobalScopes()->find($document->related_document_id);

        if ($original !== null && $original->local_status !== DocumentStatus::Voided) {
            $original->forceFill(['local_status' => DocumentStatus::Voided])->save();
        }

        $sale = $original?->sale_id ? Sale::query()->withoutGlobalScopes()->find($original->sale_id) : null;

        if ($sale !== null && ! $sale->isVoided()) {
            $this->sales->void($sale, "Anulada con nota de crédito {$document->fullNumber()}", fromCreditNote: true);
        }
    }

    private function markUnknown(ElectronicDocument $document, string $error): void
    {
        $document->forceFill([
            'local_status' => DocumentStatus::Unknown,
            'last_error' => $error,
            'next_check_at' => now()->addMinutes(2),
        ])->save();

        $this->activity->log('document.unknown', "Sin confirmación de la API para {$document->fullNumber()}: se verificará antes de reintentar.", $document);
    }

    private function markFailed(ElectronicDocument $document, string $error): void
    {
        $document->forceFill([
            'local_status' => DocumentStatus::Failed,
            'last_error' => $error,
            'next_check_at' => null,
        ])->save();

        $this->activity->log('document.failed', "La API no registró {$document->fullNumber()}: {$error}", $document);
    }

    private function scheduleNextCheck(ElectronicDocument $document, string $note): void
    {
        $document->forceFill([
            'last_checked_at' => now(),
            'check_attempts' => $document->check_attempts + 1,
            'next_check_at' => now()->addMinutes(min(2 ** min($document->check_attempts, 6), 60)),
            'last_error' => $note,
        ])->save();
    }

    // ------------------------------------------------------------------ reglas

    private function ensureCanIssue(Sale $sale, Company $company, DocumentType $type): void
    {
        $this->ensureCompanyReady($company);

        if ($sale->isVoided()) {
            throw ValidationException::withMessages(['document' => 'La venta está anulada.']);
        }

        $active = ElectronicDocument::query()->withoutGlobalScopes()
            ->where('sale_id', $sale->id)
            ->whereIn('document_type', [DocumentType::Invoice->value, DocumentType::Receipt->value])
            ->whereNotNull('issuance_key')
            ->first();

        if ($active !== null) {
            throw ValidationException::withMessages([
                'document' => "La venta ya tiene el comprobante {$active->fullNumber()} ({$active->local_status->label()}).",
            ]);
        }

        if ($type === DocumentType::Invoice && $company->billingSettings->tax_regime === 'rus') {
            throw ValidationException::withMessages(['document_type' => 'El régimen Nuevo RUS solo permite emitir boletas.']);
        }

        if ((float) $sale->total <= 0) {
            throw ValidationException::withMessages(['document' => 'La venta no tiene importe.']);
        }

        $this->ensureCustomerFits($sale, $type);
    }

    private function ensureCustomerFits(Sale $sale, DocumentType $type): void
    {
        $customer = $sale->customer;

        if ($type === DocumentType::Invoice && ($customer->document_type !== IdentityDocumentType::Ruc || blank($customer->document_number))) {
            throw ValidationException::withMessages(['document_type' => 'Para emitir factura el cliente debe tener RUC. Emita boleta o actualice los datos del cliente.']);
        }

        if ($type === DocumentType::Receipt && ($customer->document_type === IdentityDocumentType::None || blank($customer->document_number)) && (float) $sale->total >= 700) {
            throw ValidationException::withMessages(['document_type' => 'Para boletas de S/ 700 o más el cliente debe estar identificado (DNI, RUC u otro documento).']);
        }
    }

    private function ensureCompanyReady(Company $company): void
    {
        $settings = $company->billingSettings;

        if ($settings === null || ! $settings->isReady()) {
            throw ValidationException::withMessages(['document' => 'El taller todavía no está listo para facturar: el super administrador debe registrarlo en la API de facturación.']);
        }

        if ($settings->certificate_valid_to !== null && $settings->certificate_valid_to->isPast()) {
            throw ValidationException::withMessages(['document' => 'El certificado digital del taller está vencido. Pida al super administrador que lo renueve.']);
        }
    }

    private function lockSeries(Company $company, DocumentType $type, ?int $seriesId): DocumentSeries
    {
        $series = DocumentSeries::query()
            ->withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('document_type', $type->value)
            ->where('is_active', true)
            ->when($seriesId, fn ($q) => $q->whereKey($seriesId))
            ->orderBy('series')
            ->lockForUpdate()
            ->first();

        if ($series === null) {
            throw ValidationException::withMessages(['series_id' => "No hay una serie activa de {$type->label()}. Créela en Configuración del taller → Series."]);
        }

        return $series;
    }

    /**
     * @return array<string, mixed>
     */
    private function customerSnapshot(Sale $sale): array
    {
        $c = $sale->customer;

        return [
            'customer_document_type' => $c->document_type->value,
            'customer_document_number' => $c->document_number,
            'customer_name' => $c->name,
            'customer_address' => $c->address,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function issuerSnapshot(Company $company, DocumentSeries $series): array
    {
        $establishment = $series->establishment()->withoutGlobalScopes()->first();

        return [
            'issuer_ruc' => $company->ruc,
            'issuer_name' => $company->legal_name,
            'issuer_address' => $company->billingSettings->fiscal_address,
            'establishment_code' => $establishment?->local_code,
            'environment' => $company->billingSettings->environment,
        ];
    }

    private function client(ElectronicDocument $document): SunatApiClient
    {
        return SunatApiClient::forCompany(Company::query()->with('billingSettings')->findOrFail($document->company_id));
    }

    /**
     * @param  array<mixed>  $datos
     * @return list<mixed>
     */
    private function listOf(array $datos): array
    {
        if (array_is_list($datos)) {
            return $datos;
        }

        foreach (['data', 'items', 'facturas', 'boletas'] as $key) {
            if (isset($datos[$key]) && is_array($datos[$key]) && array_is_list($datos[$key])) {
                return $datos[$key];
            }
        }

        // Un solo comprobante devuelto como objeto.
        return isset($datos['serie']) ? [$datos] : [];
    }
}
