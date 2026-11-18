<?php

namespace App\Http\Controllers\Setup;

use App\Http\Controllers\Controller;
use App\Http\Requests\Setup\StoreSuperAdminRequest;
use App\Services\Audit\ActivityLogger;
use App\Services\Setup\InstallationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SetupController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('setup/welcome', [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(
        StoreSuperAdminRequest $request,
        InstallationService $installation,
        ActivityLogger $activity,
    ): RedirectResponse {
        /** @var array{first_name: string, last_name: string, email: string, password: string} $data */
        $data = $request->safe()->only(['first_name', 'last_name', 'email', 'password']);

        $user = $installation->createSuperAdmin($data);

        Auth::login($user);
        $request->session()->regenerate();

        $activity->log('setup.completed', 'Instalación inicial: se registró el primer super administrador.', $user, user: $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => '¡Bienvenido! El sistema quedó instalado correctamente.']);

        return redirect()->route('dashboard');
    }
}
