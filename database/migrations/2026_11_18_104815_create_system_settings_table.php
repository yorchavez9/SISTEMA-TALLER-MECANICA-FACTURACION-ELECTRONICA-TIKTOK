<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Estado de instalación del sistema.
 *
 * Tabla de una sola fila (id = 1) sembrada aquí mismo. El Setup Wizard la
 * bloquea con SELECT ... FOR UPDATE para serializar la creación del primer
 * super admin frente a peticiones simultáneas. Con una base de datos nueva la
 * fila vuelve a crearse con installed_at = null y el wizard reaparece solo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->timestamp('installed_at')->nullable();
            $table->foreignId('installed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('system_settings')->insert([
            'id' => 1,
            'installed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
