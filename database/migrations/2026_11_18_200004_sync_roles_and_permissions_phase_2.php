<?php

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Migrations\Migration;

/**
 * Fase 2: permisos de configuración del taller y de usuarios.
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
