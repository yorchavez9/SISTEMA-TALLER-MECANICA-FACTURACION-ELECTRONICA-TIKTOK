<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comprobantes electrónicos (factura, boleta, NC, ND).
 *
 * Guarda una INSTANTÁNEA inmutable del emisor, del receptor, de los totales
 * y del payload enviado: si después cambia la configuración del taller, los
 * comprobantes históricos no cambian.
 *
 * Protección contra duplicados (docs §8.4):
 * - issuance_key UNIQUE ("sale:{id}" para 01/03) → una venta, un comprobante activo.
 * - (company, tipo, serie, número) UNIQUE.
 * - Correlativo reservado localmente con bloqueo de la serie.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('electronic_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('related_document_id')->nullable()->constrained('electronic_documents')->restrictOnDelete();
            $table->foreignId('document_series_id')->nullable()->constrained('document_series')->nullOnDelete();
            $table->char('document_type', 2); // 01 | 03 | 07 | 08
            $table->char('series', 4);
            $table->unsignedInteger('number');
            $table->date('issue_date');
            $table->char('currency', 3)->default('PEN');
            $table->decimal('taxable_amount', 12, 2);
            $table->decimal('igv', 12, 2);
            $table->decimal('total', 12, 2);

            // Instantáneas
            $table->string('customer_document_type', 1);
            $table->string('customer_document_number', 15)->nullable();
            $table->string('customer_name');
            $table->string('customer_address')->nullable();
            $table->char('issuer_ruc', 11);
            $table->string('issuer_name');
            $table->string('issuer_address')->nullable();
            $table->char('establishment_code', 4)->nullable();
            $table->string('environment', 20);

            // Notas de crédito / débito
            $table->char('reason_code', 2)->nullable();
            $table->string('reason_description')->nullable();

            // Detracción (instantánea del tipo y % elegidos al emitir)
            $table->char('detraction_code', 3)->nullable();
            $table->decimal('detraction_rate', 5, 2)->nullable();
            $table->decimal('detraction_amount', 12, 2)->nullable();
            $table->string('detraction_account', 30)->nullable();
            $table->char('detraction_payment_method', 3)->nullable();
            $table->string('detraction_override_reason')->nullable();

            // Integración con la API
            $table->string('issuance_key')->nullable()->unique();
            $table->unsignedBigInteger('api_document_id')->nullable();
            $table->string('api_status', 20)->nullable();   // pendiente | enviado | aceptado | rechazado (literal de la API)
            $table->string('local_status', 20);             // sending | failed | unknown | pending | sent | accepted | rejected | voided
            $table->string('sunat_code', 20)->nullable();
            $table->text('sunat_message')->nullable();
            $table->text('last_error')->nullable();
            $table->json('request_payload');
            $table->json('last_response')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamp('next_check_at')->nullable();
            $table->unsignedSmallInteger('check_attempts')->default(0);
            $table->string('xml_path')->nullable(); // caché privada tras aceptación
            $table->string('cdr_path')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'document_type', 'series', 'number'], 'edocs_company_type_series_number_unique');
            $table->index(['company_id', 'local_status', 'next_check_at']);
            $table->index(['company_id', 'issue_date']);
            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('electronic_documents');
    }
};
