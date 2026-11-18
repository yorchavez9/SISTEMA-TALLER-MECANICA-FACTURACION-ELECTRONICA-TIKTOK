<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('establishments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('api_branch_id')->nullable(); // id de la sucursal en la API
            $table->string('name', 100);
            $table->char('local_code', 4); // "0000" = establecimiento principal (SUNAT)
            $table->string('address');
            $table->char('ubigeo', 6);
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->boolean('is_main')->default(false);
            $table->timestamps();

            $table->unique(['company_id', 'local_code']);
        });

        Schema::create('document_series', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('establishment_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('api_series_id')->nullable();
            $table->char('document_type', 2); // 01 factura, 03 boleta, 07 NC, 08 ND
            $table->char('series', 4);
            $table->unsignedInteger('initial_number')->default(0);
            // Último correlativo usado localmente (se bloquea al emitir, Fase 6).
            $table->unsignedInteger('last_number')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'document_type', 'series']);
            $table->index(['company_id', 'document_type', 'is_active']);
        });

        Schema::create('detraction_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->char('code', 3); // cat. 54 (cod_bien)
            $table->string('description', 150);
            $table->decimal('rate', 5, 2);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->unique(['company_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detraction_types');
        Schema::dropIfExists('document_series');
        Schema::dropIfExists('establishments');
    }
};
