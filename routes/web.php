<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\Admin\CompanyApiLogController;
use App\Http\Controllers\Admin\CompanyBillingController;
use App\Http\Controllers\Admin\CompanyContextController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Catalog\CatalogSearchController;
use App\Http\Controllers\Catalog\CustomerController;
use App\Http\Controllers\Catalog\ProductController;
use App\Http\Controllers\Catalog\ServiceController;
use App\Http\Controllers\Catalog\VehicleController;
use App\Http\Controllers\CompanySettings\BillingStatusController;
use App\Http\Controllers\CompanySettings\DetractionController;
use App\Http\Controllers\CompanySettings\EstablishmentController;
use App\Http\Controllers\CompanySettings\ProfileController as CompanyProfileController;
use App\Http\Controllers\CompanySettings\SeriesController;
use App\Http\Controllers\CompanySettings\UserController as CompanyUserController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LookupController;
use App\Http\Controllers\Setup\SetupController;
use App\Http\Controllers\WorkOrders\WorkOrderController;
use Illuminate\Support\Facades\Route;

/*
| Setup Wizard: solo disponible mientras no exista el primer super admin.
| Una vez instalado responde 404 (middleware installed.block).
*/
Route::middleware(['guest', 'installed.block'])->prefix('setup')->name('setup.')->group(function () {
    Route::get('/', [SetupController::class, 'show'])->name('show');
    Route::post('/', [SetupController::class, 'store'])->middleware('throttle:5,1')->name('store');
});

Route::redirect('/', '/dashboard')->name('home');

Route::middleware('auth')->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('activity-logs', [ActivityLogController::class, 'index'])
        ->middleware('can:activity_logs.view')
        ->name('activity-logs.index');

    // Consultas para formularios (ubigeo, RUC/DNI) vía API.
    Route::prefix('lookups')->name('lookups.')->middleware('throttle:60,1')->group(function () {
        Route::get('ubigeo', [LookupController::class, 'ubigeo'])->name('ubigeo');
        Route::get('document', [LookupController::class, 'document'])->name('document');
    });

    /*
    | Super admin: talleres y configuración de la API de facturación.
    */
    Route::middleware('role:super_admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('companies', [CompanyController::class, 'index'])->name('companies.index');
        Route::get('companies/create', [CompanyController::class, 'create'])->name('companies.create');
        Route::post('companies', [CompanyController::class, 'store'])->name('companies.store');
        Route::get('companies/{company}', [CompanyController::class, 'show'])->name('companies.show');
        Route::patch('companies/{company}', [CompanyController::class, 'update'])->name('companies.update');

        Route::post('companies/{company}/enter', [CompanyContextController::class, 'store'])->name('companies.enter');
        Route::delete('company-context', [CompanyContextController::class, 'destroy'])->name('companies.leave');

        Route::get('companies/{company}/api-logs', [CompanyApiLogController::class, 'index'])->name('companies.api-logs');

        Route::prefix('companies/{company}/billing')->name('companies.billing.')->middleware('throttle:20,1')->group(function () {
            Route::post('provision', [CompanyBillingController::class, 'provision'])->name('provision');
            Route::post('sync', [CompanyBillingController::class, 'synchronize'])->name('sync');
            Route::post('certificate', [CompanyBillingController::class, 'certificate'])->name('certificate');
            Route::post('plan', [CompanyBillingController::class, 'plan'])->name('plan');
            Route::post('subscription/cancel', [CompanyBillingController::class, 'cancelSubscription'])->name('subscription.cancel');
            Route::put('environment', [CompanyBillingController::class, 'environment'])->name('environment');
            Route::put('advanced', [CompanyBillingController::class, 'advanced'])->name('advanced');
            Route::post('test', [CompanyBillingController::class, 'test'])->name('test');
            Route::post('credentials/regenerate', [CompanyBillingController::class, 'regenerateCredentials'])->name('credentials.regenerate');
            Route::post('credentials/recover', [CompanyBillingController::class, 'requestRecovery'])->name('credentials.recover');
            Route::post('credentials/recover/verify', [CompanyBillingController::class, 'verifyRecovery'])->name('credentials.verify');
            Route::delete('tenant', [CompanyBillingController::class, 'destroyTenant'])->name('tenant.destroy');
        });
    });

    /*
    | Maestros del taller (empresa actual). La autorización está en las policies.
    */
    Route::middleware('company')->group(function () {
        Route::get('customers/search', [CustomerController::class, 'search'])->middleware('throttle:120,1')->name('customers.search');
        Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::post('customers', [CustomerController::class, 'store'])->name('customers.store');
        Route::get('customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
        Route::put('customers/{customer}', [CustomerController::class, 'update'])->name('customers.update');
        Route::delete('customers/{customer}', [CustomerController::class, 'destroy'])->name('customers.destroy');

        Route::get('vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
        Route::post('vehicles', [VehicleController::class, 'store'])->name('vehicles.store');
        Route::put('vehicles/{vehicle}', [VehicleController::class, 'update'])->name('vehicles.update');
        Route::delete('vehicles/{vehicle}', [VehicleController::class, 'destroy'])->name('vehicles.destroy');

        Route::get('services', [ServiceController::class, 'index'])->name('services.index');
        Route::post('services', [ServiceController::class, 'store'])->name('services.store');
        Route::put('services/{service}', [ServiceController::class, 'update'])->name('services.update');
        Route::delete('services/{service}', [ServiceController::class, 'destroy'])->name('services.destroy');

        Route::get('products', [ProductController::class, 'index'])->name('products.index');
        Route::get('products/create', [ProductController::class, 'create'])->name('products.create');
        Route::post('products', [ProductController::class, 'store'])->name('products.store');
        Route::get('products/{product}', [ProductController::class, 'show'])->name('products.show');
        Route::get('products/{product}/edit', [ProductController::class, 'edit'])->name('products.edit');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
        Route::post('products/{product}/stock', [ProductController::class, 'adjustStock'])->middleware('throttle:60,1')->name('products.stock.adjust');

        // Búsquedas para selectores (OT y ventas).
        Route::middleware('throttle:120,1')->group(function () {
            Route::get('lookups/services', [CatalogSearchController::class, 'services'])->name('catalog.services');
            Route::get('lookups/products', [CatalogSearchController::class, 'products'])->name('catalog.products');
            Route::get('customers/{customer}/vehicles', [CatalogSearchController::class, 'customerVehicles'])->name('customers.vehicles');
        });

        // Órdenes de trabajo.
        Route::get('work-orders', [WorkOrderController::class, 'index'])->name('work-orders.index');
        Route::get('work-orders/create', [WorkOrderController::class, 'create'])->name('work-orders.create');
        Route::post('work-orders', [WorkOrderController::class, 'store'])->name('work-orders.store');
        Route::get('work-orders/{workOrder}', [WorkOrderController::class, 'show'])->name('work-orders.show');
        Route::put('work-orders/{workOrder}', [WorkOrderController::class, 'update'])->name('work-orders.update');
        Route::post('work-orders/{workOrder}/status', [WorkOrderController::class, 'changeStatus'])->name('work-orders.status');
        Route::get('work-orders/{workOrder}/print', [WorkOrderController::class, 'print'])->name('work-orders.print');
        Route::post('work-orders/{workOrder}/items', [WorkOrderController::class, 'storeItem'])->name('work-orders.items.store');
        Route::put('work-orders/{workOrder}/items/{item}', [WorkOrderController::class, 'updateItem'])->name('work-orders.items.update');
        Route::delete('work-orders/{workOrder}/items/{item}', [WorkOrderController::class, 'destroyItem'])->name('work-orders.items.destroy');
    });

    /*
    | Configuración del taller (empresa actual).
    */
    Route::middleware('company')->prefix('company-settings')->name('company-settings.')->group(function () {
        Route::middleware('can:company_settings.manage')->group(function () {
            Route::get('profile', [CompanyProfileController::class, 'edit'])->name('profile.edit');
            Route::put('profile', [CompanyProfileController::class, 'update'])->name('profile.update');
            Route::post('logo', [CompanyProfileController::class, 'updateLogo'])->name('logo.update');

            Route::get('establishments', [EstablishmentController::class, 'index'])->name('establishments.index');
            Route::post('establishments', [EstablishmentController::class, 'store'])->name('establishments.store');
            Route::put('establishments/{establishment}', [EstablishmentController::class, 'update'])->name('establishments.update');
            Route::delete('establishments/{establishment}', [EstablishmentController::class, 'destroy'])->name('establishments.destroy');

            Route::get('series', [SeriesController::class, 'index'])->name('series.index');
            Route::post('series', [SeriesController::class, 'store'])->name('series.store');
            Route::patch('series/{series}', [SeriesController::class, 'update'])->name('series.update');

            Route::get('detraction', [DetractionController::class, 'index'])->name('detraction.index');
            Route::put('detraction', [DetractionController::class, 'updateSettings'])->name('detraction.settings');
            Route::post('detraction/types', [DetractionController::class, 'store'])->name('detraction.types.store');
            Route::put('detraction/types/{detractionType}', [DetractionController::class, 'update'])->name('detraction.types.update');

            Route::get('billing', BillingStatusController::class)->name('billing');
        });

        Route::middleware('can:company_users.manage')->group(function () {
            Route::get('users', [CompanyUserController::class, 'index'])->name('users.index');
            Route::post('users', [CompanyUserController::class, 'store'])->name('users.store');
            Route::put('users/{user}', [CompanyUserController::class, 'update'])->name('users.update');
            Route::patch('users/{user}/toggle', [CompanyUserController::class, 'toggle'])->name('users.toggle');
        });
    });
});

require __DIR__.'/settings.php';
