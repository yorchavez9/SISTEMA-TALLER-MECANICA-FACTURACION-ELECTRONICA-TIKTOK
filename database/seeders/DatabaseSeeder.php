<?php

namespace Database\Seeders;

use App\Support\Authorization\RoleRegistry;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * No se crean usuarios aquí: el primer super admin se registra con el
     * Setup Wizard. Solo se sincronizan roles y permisos (idempotente).
     */
    public function run(): void
    {
        RoleRegistry::sync();
    }
}
