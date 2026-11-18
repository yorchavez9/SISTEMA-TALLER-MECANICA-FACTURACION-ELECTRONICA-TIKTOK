<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Preferencia de tema (claro, oscuro o sistema) guardada por usuario.
 */
class AppearanceController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/appearance');
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['required', 'string', Rule::in(User::THEMES)],
        ]);

        $request->user()->forceFill(['theme' => $validated['theme']])->save();

        return back()->withCookie(cookie()->forever('appearance', $validated['theme'], httpOnly: false));
    }
}
