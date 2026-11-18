<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureCompanyContext;
use App\Models\Company;
use App\Services\Audit\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * El super admin "entra" a un taller para operar su configuración y datos.
 */
class CompanyContextController extends Controller
{
    public function store(Request $request, Company $company, ActivityLogger $activity): RedirectResponse
    {
        $request->session()->put(EnsureCompanyContext::SESSION_KEY, $company->id);

        $activity->log('admin.company_entered', "El super administrador entró al taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess("Ahora está operando en {$company->displayName()}.");

        return redirect()->route('company-settings.profile.edit');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->session()->forget(EnsureCompanyContext::SESSION_KEY);

        return redirect()->route('admin.companies.index');
    }
}
