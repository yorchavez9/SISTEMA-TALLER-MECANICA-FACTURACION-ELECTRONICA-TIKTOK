<?php

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Migrations\Migration;

/**
 * Crea (de forma idempotente) los roles y permisos del sistema para que existan
 * antes del Setup Wizard, sin depender de ejecutar seeders manualmente.
 * Cada fase que agregue permisos debe añadir una migración que vuelva a llamar
 * a RoleRegistry::sync().
 */
return new class extends Migration
{
    public function up(): void
    {
        RoleRegistry::sync();
    }

    public function down(): void
    {
        // Los roles se eliminan junto con las tablas de permisos.
    }
};
