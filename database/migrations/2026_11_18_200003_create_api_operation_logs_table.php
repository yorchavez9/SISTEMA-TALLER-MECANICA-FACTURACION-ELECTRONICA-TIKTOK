<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bitácora de llamadas a la API SUNAT. Nunca contiene cabeceras de
 * autenticación, certificados, contraseñas ni la Clave SOL (LogSanitizer).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_operation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('operation', 60);
            $table->string('http_method', 10);
            $table->string('endpoint');
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('api_estado', 20)->nullable();
            $table->text('api_mensaje')->nullable();
            $table->json('request_summary')->nullable();
            $table->mediumText('response_body')->nullable();
            $table->string('error_type', 30)->nullable();
            $table->unsignedInteger('duration_ms')->default(0);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'created_at']);
            $table->index(['company_id', 'error_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_operation_logs');
    }
};
