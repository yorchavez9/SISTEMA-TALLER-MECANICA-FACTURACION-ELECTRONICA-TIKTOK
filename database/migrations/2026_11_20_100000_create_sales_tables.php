<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ventas: registro comercial inmutable que luego se factura (Fase 6).
 * Una OT tiene como máximo una venta activa (las anuladas quedan como historial).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number'); // V-000001 por taller
            // Una OT puede tener ventas anuladas en su historial, pero solo una
            // venta activa: lo garantiza SaleService con bloqueo de la OT.
            $table->foreignId('work_order_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->timestamp('issued_at');
            $table->char('currency', 3)->default('PEN');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('igv', 12, 2);
            $table->decimal('total', 12, 2);
            $table->string('status', 20)->default('registered'); // registered | voided
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('void_reason')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number']);
            $table->index(['company_id', 'issued_at']);
            $table->index(['company_id', 'status']);
            $table->index(['work_order_id', 'status']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10); // service | product | labor
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            // Instantánea al momento de la venta (no cambia si luego cambia el catálogo).
            $table->string('code', 40)->nullable();
            $table->string('description', 255);
            $table->string('unit', 5);
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2); // con IGV
            $table->char('igv_affectation', 2);
            $table->string('sunat_product_code', 8)->nullable();
            $table->boolean('subject_to_detraction')->default(false);
            $table->foreignId('detraction_type_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('subtotal', 12, 2);
            $table->decimal('igv', 12, 2);
            $table->decimal('total', 12, 2);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->string('method', 20); // cash | card | yape | plin | transfer
            $table->decimal('amount', 12, 2);
            $table->string('reference', 100)->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
    }
};
