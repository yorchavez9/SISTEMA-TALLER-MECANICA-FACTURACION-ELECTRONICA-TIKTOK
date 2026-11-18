<?php

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Migrations\Migration;

/**
 * Fase 3: permisos de clientes, vehículos, servicios, productos e inventario.
 */
return new class extends Migration
{
    public function up(): void
    {
        RoleRegistry::sync();
    }

    public function down(): void
    {
        //
    }
};
