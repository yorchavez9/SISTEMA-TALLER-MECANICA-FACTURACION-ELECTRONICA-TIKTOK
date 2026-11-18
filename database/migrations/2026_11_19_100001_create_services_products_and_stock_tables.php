<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2); // con IGV (igual que precio_unitario de la API)
            $table->char('igv_affectation', 2)->default('10');
            $table->string('sunat_product_code', 8)->nullable();
            $table->boolean('subject_to_detraction')->default(true);
            $table->foreignId('detraction_type_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'is_active', 'name']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->decimal('cost', 12, 2)->default(0);
            $table->decimal('sale_price', 12, 2); // con IGV
            $table->decimal('stock', 12, 3)->default(0);
            $table->decimal('min_stock', 12, 3)->nullable();
            $table->string('unit', 5)->default('NIU'); // cat. 03 SUNAT
            $table->char('igv_affectation', 2)->default('10');
            $table->string('sunat_product_code', 8)->nullable();
            // Ruta relativa en el disco "public"; nunca el binario. Opcional.
            $table->string('image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['company_id', 'code']);
            $table->index(['company_id', 'is_active', 'name']);
        });

        // Kardex básico: el stock solo cambia mediante movimientos.
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10); // in | out | adjust | return
            $table->decimal('quantity', 12, 3); // con signo
            $table->decimal('balance_after', 12, 3);
            $table->string('reason');
            $table->nullableMorphs('source'); // venta, nota de crédito… (fases siguientes)
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('products');
        Schema::dropIfExists('services');
    }
};
