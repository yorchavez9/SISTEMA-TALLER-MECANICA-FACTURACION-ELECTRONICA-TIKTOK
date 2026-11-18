<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number'); // correlativo por taller (OT-000001)
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('mileage_in')->nullable();
            $table->text('reported_problem');
            $table->text('diagnosis')->nullable();
            $table->text('observations')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('received_at');
            $table->timestamp('promised_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            // Totales derivados de los ítems (precios con IGV); se recalculan en el servicio.
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('igv', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'number']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'vehicle_id', 'received_at']);
        });

        // Servicios, repuestos y mano de obra en una sola tabla.
        Schema::create('work_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10); // service | product | labor
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description', 255);
            $table->string('unit', 5);
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2); // con IGV
            $table->char('igv_affectation', 2)->default('10');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('igv', 12, 2);
            $table->decimal('total', 12, 2);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['work_order_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_items');
        Schema::dropIfExists('work_orders');
    }
};
