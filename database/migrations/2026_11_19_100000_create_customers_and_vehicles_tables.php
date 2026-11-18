<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            // Cat. 06 SUNAT: 0 sin documento, 1 DNI, 4 CE, 6 RUC, 7 pasaporte, A cédula diplomática.
            $table->string('document_type', 1);
            $table->string('document_number', 15)->nullable();
            $table->string('name');
            $table->string('trade_name')->nullable();
            $table->string('address')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'document_type', 'document_number']);
            $table->index(['company_id', 'name']);
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            // Placa normalizada: mayúsculas, sin espacios ni guiones (ABC123).
            $table->string('plate', 10);
            $table->string('brand', 60);
            $table->string('model', 60);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('color', 40)->nullable();
            $table->string('vin', 30)->nullable();
            $table->string('engine_number', 30)->nullable();
            $table->unsignedInteger('current_mileage')->default(0);
            $table->text('features')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'plate']);
            $table->index(['company_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('customers');
    }
};
