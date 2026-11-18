<?php

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Migrations\Migration;

/**
 * Fase 4: permisos de órdenes de trabajo.
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
