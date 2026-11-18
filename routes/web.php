<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Setup\SetupController;
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
});

require __DIR__.'/settings.php';
