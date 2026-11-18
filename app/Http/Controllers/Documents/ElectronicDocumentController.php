<?php

namespace App\Http\Controllers\Documents;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Models\ElectronicDocument;
use App\Models\Sale;
use App\Services\SunatApi\DocumentIssuer;
use App\Services\SunatApi\Exceptions\SunatApiException;
use App\Services\SunatApi\SunatApiClient;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ElectronicDocumentController extends Controller
{
    public function __construct(
        private readonly DocumentIssuer $issuer,
        private readonly CurrentCompany $current,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', ElectronicDocument::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::enum(DocumentType::class)],
            'status' => ['nullable', Rule::enum(DocumentStatus::class)],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $search = $filters['search'] ?? null;

        $documents = ElectronicDocument::query()
            ->when($search, function (Builder $q, string $s): void {
                $parts = explode('-', strtoupper($s));
                $q->where(fn (Builder $q) => $q
                    ->where('customer_name', 'like', "%{$s}%")
                    ->orWhere('customer_document_number', 'like', "{$s}%")
                    ->when(count($parts) === 2 && is_numeric($parts[1]), fn (Builder $q) => $q->orWhere(fn (Builder $q) => $q->where('series', $parts[0])->where('number', (int) $parts[1])))
                    ->orWhere('series', strtoupper($s)));
            })
            ->when($filters['type'] ?? null, fn (Builder $q, string $t) => $q->where('document_type', $t))
            ->when($filters['status'] ?? null, fn (Builder $q, string $st) => $q->where('local_status', $st))
            ->when($filters['from'] ?? null, fn (Builder $q, string $d) => $q->where('issue_date', '>=', $d))
            ->when($filters['to'] ?? null, fn (Builder $q, string $d) => $q->where('issue_date', '<=', $d))
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (ElectronicDocument $d) => $this->row($d));

        return Inertia::render('documents/index', [
            'documents' => $documents,
            'filters' => [
                'search' => $search ?? '',
                'type' => $filters['type'] ?? '',
                'status' => $filters['status'] ?? '',
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'types' => DocumentType::options(),
            'statuses' => DocumentStatus::options(),
        ]);
    }

    /**
     * Emite factura o boleta de una venta.
     */
    public function issue(Request $request, Sale $sale): RedirectResponse
    {
        Gate::authorize('view', $sale);
        abort_unless($request->user()->can('documents.issue'), 403);

        $validated = $request->validate([
            'document_type' => ['required', Rule::in([DocumentType::Invoice->value, DocumentType::Receipt->value])],
            'series_id' => ['nullable', 'integer', Rule::exists('document_series', 'id')->where('company_id', $this->current->id())],
            'detraction' => ['nullable', 'array'],
            'detraction.apply' => ['boolean'],
            'detraction.type_id' => ['nullable', 'integer', Rule::exists('detraction_types', 'id')->where('company_id', $this->current->id())],
            'detraction.rate' => ['nullable', 'numeric', 'gt:0', 'max:100', 'decimal:0,2'],
            'detraction.override_reason' => ['nullable', 'string', 'max:255'],
        ], [], [
            'document_type' => 'tipo de comprobante',
            'series_id' => 'serie',
            'detraction.type_id' => 'tipo de detracción',
            'detraction.rate' => 'porcentaje de detracción',
            'detraction.override_reason' => 'motivo',
        ]);

        $choice = isset($validated['detraction']) ? [
            'apply' => (bool) ($validated['detraction']['apply'] ?? false),
            'type_id' => $validated['detraction']['type_id'] ?? null,
            'rate' => $validated['detraction']['rate'] ?? null,
            'override_reason' => $validated['detraction']['override_reason'] ?? null,
        ] : null;

        $document = $this->issuer->issue($sale, DocumentType::from($validated['document_type']), $validated['series_id'] ?? null, $choice);

        $this->flashResult($document);

        return back();
    }

    public function refresh(ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('operate', $document);

        try {
            $this->issuer->refresh($document);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo consultar el estado');
        }

        $this->flashResult($document->fresh());

        return back();
    }

    public function verify(ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('operate', $document);

        try {
            $this->issuer->verify($document);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo verificar en la API');
        }

        $this->flashResult($document->fresh());

        return back();
    }

    public function retry(ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('operate', $document);

        $document = $this->issuer->retry($document);
        $this->flashResult($document);

        return back();
    }

    public function resend(ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('operate', $document);

        try {
            $this->issuer->resend($document);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo reenviar a SUNAT');
        }

        $this->flashResult($document->fresh());

        return back();
    }

    public function discard(ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('operate', $document);

        $this->issuer->discard($document);
        $this->toastSuccess('Intento descartado. Puede emitir el comprobante nuevamente.');

        return back();
    }

    public function creditNote(Request $request, ElectronicDocument $document): RedirectResponse
    {
        Gate::authorize('creditNote', $document);

        $validated = $request->validate([
            'description' => ['required', 'string', 'min:5', 'max:250'],
        ], [], ['description' => 'motivo']);

        $note = $this->issuer->creditNote($document, $validated['description']);
        $this->flashResult($note);

        return back();
    }

    /**
     * Descarga PDF, XML o CDR desde la API. XML y CDR se guardan en caché
     * privada una vez aceptado el comprobante (no cambian).
     */
    public function file(Request $request, ElectronicDocument $document, string $kind): HttpResponse
    {
        Gate::authorize('view', $document);
        abort_unless(in_array($kind, ['pdf', 'xml', 'cdr'], true), 404);

        if ($document->api_document_id === null) {
            return $this->backWithApiError(new SunatApiException('El comprobante aún no está registrado en la API.'), 'No disponible');
        }

        $format = $request->query('format', 'a4');
        abort_unless(in_array($format, ['a4', 'a5', 'ticket-80', 'ticket-58'], true), 404);

        $extension = match ($kind) {
            'pdf' => 'pdf',
            'xml' => 'xml',
            'cdr' => 'zip',
        };
        $name = $document->issuer_ruc.'-'.$document->document_type->value.'-'.$document->fullNumber().($kind === 'cdr' ? '-CDR' : '').'.'.$extension;
        $cacheColumn = $kind === 'xml' ? 'xml_path' : ($kind === 'cdr' ? 'cdr_path' : null);

        if ($cacheColumn !== null && $document->{$cacheColumn} && Storage::disk('local')->exists($document->{$cacheColumn})) {
            return Storage::disk('local')->download($document->{$cacheColumn}, $name);
        }

        try {
            $client = SunatApiClient::forCompany($this->current->getOrFail()->load('billingSettings'));
            $file = $client->download(
                $document->apiResource().'/'.$document->api_document_id.'/'.$kind,
                $kind === 'pdf' ? ['format' => $format] : [],
                'download_'.$kind,
            );
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, $kind === 'cdr' ? 'El CDR aún no está disponible' : 'No se pudo descargar el archivo');
        }

        if ($cacheColumn !== null && $document->local_status === DocumentStatus::Accepted) {
            $path = 'companies/'.$document->company_id.'/documents/'.$name;
            Storage::disk('local')->put($path, $file['body']);
            $document->forceFill([$cacheColumn => $path])->save();
        }

        $disposition = $kind === 'pdf' ? 'inline' : 'attachment';

        return response($file['body'], 200, [
            'Content-Type' => $kind === 'pdf' ? 'application/pdf' : ($kind === 'xml' ? 'application/xml' : 'application/zip'),
            'Content-Disposition' => $disposition.'; filename="'.$name.'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function row(ElectronicDocument $d): array
    {
        return [
            'id' => $d->id,
            'document_type' => $d->document_type->value,
            'document_type_label' => $d->document_type->label(),
            'number' => $d->fullNumber(),
            'issue_date' => $d->issue_date->toDateString(),
            'customer_name' => $d->customer_name,
            'customer_document' => $d->customer_document_number,
            'total' => $d->total,
            'status' => $d->local_status->value,
            'status_label' => $d->local_status->label(),
            'status_tone' => $d->local_status->tone(),
            'sunat_code' => $d->sunat_code,
            'sunat_message' => $d->sunat_message,
            'last_error' => $d->last_error,
            'environment' => $d->environment,
            'sale_id' => $d->sale_id,
            'related_document_id' => $d->related_document_id,
            'reason_description' => $d->reason_description,
            'detraction' => $d->detraction_code ? [
                'code' => $d->detraction_code,
                'rate' => $d->detraction_rate,
                'amount' => $d->detraction_amount,
            ] : null,
            'has_api_id' => $d->api_document_id !== null,
            'accepted_at' => $d->accepted_at?->toIso8601String(),
            'last_checked_at' => $d->last_checked_at?->toIso8601String(),
        ];
    }

    private function flashResult(ElectronicDocument $document): void
    {
        $label = $document->document_type->label().' '.$document->fullNumber();

        $toast = match ($document->local_status) {
            DocumentStatus::Accepted => ['type' => 'success', 'message' => "{$label} aceptada por SUNAT."],
            DocumentStatus::Pending, DocumentStatus::Sent, DocumentStatus::Sending => ['type' => 'info', 'message' => "{$label} registrada en la API; SUNAT la está procesando. Consulte el estado en unos momentos."],
            DocumentStatus::Rejected => ['type' => 'error', 'message' => "{$label} rechazada por SUNAT: ".($document->sunat_message ?? 'revise el detalle.')],
            DocumentStatus::Unknown => ['type' => 'warning', 'message' => "{$label}: sin confirmación de la API. No la emita de nuevo; use \"Verificar\"."],
            DocumentStatus::Failed => ['type' => 'error', 'message' => "{$label} no se registró en la API: ".($document->last_error ?? '')],
            DocumentStatus::Voided => ['type' => 'info', 'message' => "{$label} anulada."],
        };

        Inertia::flash('toast', $toast);
    }
}
