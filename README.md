# SISTEMA-TALLER-MECANICA-FACTURACION-ELECTRONICA-TIKTOK

Sistema de gestión para talleres mecánicos con facturación electrónica SUNAT Perú (multiempresa).

**Stack:** Laravel 13 · Inertia 3 · React 19 + TypeScript · MySQL 8 · shadcn/ui · Tailwind CSS 4 · Lucide.

El análisis técnico y el plan por fases están en [`docs/ANALISIS-Y-PLAN.md`](docs/ANALISIS-Y-PLAN.md).

## Estado

- [x] **Fase 1:** base del proyecto, Setup Wizard del primer super admin, autenticación, roles, diseño (`#4361ee`, modo claro/oscuro) y tabla responsive.
- [x] **Fase 2:** talleres (super admin), usuarios por taller, aislamiento multiempresa, registro del taller en la API SUNAT (certificado y Clave SOL se reenvían sin guardarse), plan, entorno beta/producción, credenciales cifradas, establecimientos, series y detracción configurable.
- [ ] Fases 3–8: maestros, órdenes de trabajo, ventas, comprobantes electrónicos, reportes y pruebas.

## Instalación local

Requisitos: PHP 8.3+, Composer, Node 22+, MySQL 8.

```bash
composer install
cp .env.example .env
php artisan key:generate
# Crear la base de datos (por defecto: db_taller_sunat) y ajustar DB_* en .env
php artisan migrate
npm install
composer run dev        # o: php artisan serve  +  npm run dev
```

Abra `http://localhost:8000`. En la primera instalación el sistema muestra el **registro del super administrador**; una vez creado, ese formulario queda bloqueado.

## Pruebas

```bash
php artisan test
npm run check           # lint y formato
npx tsc --noEmit        # tipos
```
