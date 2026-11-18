<?php

namespace App\Console\Commands;

use App\Enums\DocumentStatus;
use App\Models\ElectronicDocument;
use App\Services\SunatApi\DocumentIssuer;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Consulta en la API el estado de los comprobantes pendientes, enviados o sin
 * confirmar (solo lectura: GET). No crea ni reenvía comprobantes; la API es
 * quien procesa el envío a SUNAT. Se ejecuta con el Scheduler (cron), no con colas.
 */
#[Signature('sunat:sync-pending {--limit=50 : Máximo de comprobantes por ejecución}')]
#[Description('Consulta el estado de comprobantes pendientes o sin confirmar en la API SUNAT')]
class SyncPendingDocuments extends Command
{
    public function handle(DocumentIssuer $issuer): int
    {
        $documents = ElectronicDocument::query()
            ->withoutGlobalScopes()
            ->whereIn('local_status', [DocumentStatus::Pending->value, DocumentStatus::Sent->value, DocumentStatus::Unknown->value])
            ->where('created_at', '>=', now()->subHours(72))
            ->where(fn ($q) => $q->whereNull('next_check_at')->orWhere('next_check_at', '<=', now()))
            ->orderBy('next_check_at')
            ->limit((int) $this->option('limit'))
            ->get();

        $checked = 0;
        $errors = 0;

        foreach ($documents as $document) {
            try {
                $issuer->refresh($document);
                $checked++;
            } catch (SunatApiException $e) {
                $errors++;
                $this->warn("{$document->fullNumber()}: {$e->userMessage()}");
            }
        }

        $this->info("Comprobantes consultados: {$checked}. Con error: {$errors}.");

        return self::SUCCESS;
    }
}
