<?php

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Migrations\Migration;

/**
 * Fase 5: permisos de ventas.
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
