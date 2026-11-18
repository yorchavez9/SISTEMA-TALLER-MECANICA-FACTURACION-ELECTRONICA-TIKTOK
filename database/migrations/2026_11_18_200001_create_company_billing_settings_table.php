<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Configuración fiscal y de integración con la API SUNAT (1:1 con companies).
 *
 * El certificado, su contraseña, la Clave SOL y el client_secret de SUNAT NO
 * se guardan: se reenvían a la API, que los valida y cifra. Solo se registran
 * metadatos (fecha de subida y vencimiento informado por la API).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_billing_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();

            // Emisor
            $table->string('fiscal_address');
            $table->char('ubigeo', 6);
            $table->string('department', 60);
            $table->string('province', 60);
            $table->string('district', 60);
            $table->string('tax_regime', 20)->default('general');
            $table->string('nrus_category', 5)->nullable();
            $table->decimal('igv_rate', 5, 2)->nullable(); // tasa_igv_vigente informada por la API
            $table->decimal('igv_rate_override', 5, 2)->nullable();
            $table->string('thanks_message')->nullable();

            // Integración API (solo el super admin cambia entorno, plan y certificado)
            $table->string('environment', 20)->default('beta');
            $table->timestamp('environment_changed_at')->nullable();
            $table->foreignId('environment_changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('api_key')->nullable();    // cifrado (cast encrypted)
            $table->text('api_secret')->nullable(); // cifrado (cast encrypted)
            $table->string('sunat_client_id')->nullable();
            $table->string('status', 30)->default('not_configured');
            $table->timestamp('provisioned_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamp('last_validated_at')->nullable();
            $table->text('last_error')->nullable();

            // Certificado (solo metadatos)
            $table->timestamp('certificate_uploaded_at')->nullable();
            $table->foreignId('certificate_uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('certificate_valid_to')->nullable();

            // Detracción (configuración general; tipos y % en detraction_types)
            $table->boolean('detraction_enabled')->default(true);
            $table->string('detraction_account', 30)->nullable();
            $table->char('detraction_payment_method', 3)->default('001');
            $table->decimal('detraction_threshold', 12, 2)->default(700);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_billing_settings');
    }
};
