<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BillingStatus;
use App\Enums\TaxRegime;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCompanyRequest;
use App\Models\Company;
use App\Models\DocumentSeries;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use App\Services\Companies\CompanyRegistrar;
use App\Services\SunatApi\SubscriptionManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Talleres (solo super admin).
 */
class CompanyController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:active,suspended'],
        ]);

        $search = $filters['search'] ?? null;

        $companies = Company::query()
            ->with('billingSettings:id,company_id,status,environment')
            ->withCount('users')
            ->when($search, fn (Builder $q, string $s) => $q->where(fn (Builder $q) => $q
                ->where('ruc', 'like', "%{$s}%")
                ->orWhere('legal_name', 'like', "%{$s}%")
                ->orWhere('trade_name', 'like', "%{$s}%")))
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->orderBy('legal_name')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Company $c): array => [
                'id' => $c->id,
                'ruc' => $c->ruc,
                'legal_name' => $c->legal_name,
                'trade_name' => $c->trade_name,
                'status' => $c->status,
                'api_plan' => $c->api_plan,
                'users_count' => $c->users_count,
                'billing_status' => $c->billingSettings?->status->value,
                'billing_status_label' => $c->billingSettings?->status->label(),
                'environment' => $c->billingSettings?->environment,
                'created_at' => $c->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/companies/index', [
            'companies' => $companies,
            'filters' => ['search' => $search ?? '', 'status' => $filters['status'] ?? ''],
        ]);
    }

    public function create(SubscriptionManager $subscriptions): Response
    {
        return Inertia::render('admin/companies/create', [
            'plans' => $subscriptions->plans(),
            'taxRegimes' => TaxRegime::options(),
            'defaultEnvironment' => config('sunat_api.default_environment'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(StoreCompanyRequest $request, CompanyRegistrar $registrar, ActivityLogger $activity): RedirectResponse
    {
        $company = $registrar->create($request->validated());

        $activity->log('company.created', "Se registró el taller {$company->legal_name} (RUC {$company->ruc}).", $company, company: $company);

        $this->toastSuccess('Taller registrado. Ahora regístrelo en la API de facturación con su certificado y Clave SOL.');

        return redirect()->route('admin.companies.show', $company);
    }

    public function show(Company $company, SubscriptionManager $subscriptions): Response
    {
        $company->load('billingSettings', 'establishments');
        $settings = $company->billingSettings;
        $connected = $settings?->hasCredentials() ?? false;

        return Inertia::render('admin/companies/show', [
            'company' => [
                'id' => $company->id,
                'uuid' => $company->uuid,
                'ruc' => $company->ruc,
                'legal_name' => $company->legal_name,
                'trade_name' => $company->trade_name,
                'email' => $company->email,
                'phone' => $company->phone,
                'status' => $company->status,
                'api_plan' => $company->api_plan,
                'logo_url' => $company->logoUrl(),
                'created_at' => $company->created_at?->toIso8601String(),
            ],
            'billing' => $settings ? [
                'status' => $settings->status->value,
                'status_label' => $settings->status->label(),
                'connected' => $connected,
                'environment' => $settings->environment,
                'environment_changed_at' => $settings->environment_changed_at?->toIso8601String(),
                'tax_regime' => $settings->tax_regime,
                'igv_rate' => $settings->igv_rate,
                'igv_rate_override' => $settings->igv_rate_override,
                'sunat_client_id' => $settings->sunat_client_id,
                'fiscal_address' => $settings->fiscal_address,
                'ubigeo' => $settings->ubigeo,
                'district' => $settings->district,
                'province' => $settings->province,
                'department' => $settings->department,
                'provisioned_at' => $settings->provisioned_at?->toIso8601String(),
                'last_synced_at' => $settings->last_synced_at?->toIso8601String(),
                'last_validated_at' => $settings->last_validated_at?->toIso8601String(),
                'last_error' => $settings->last_error,
                'certificate_uploaded_at' => $settings->certificate_uploaded_at?->toIso8601String(),
                'certificate_valid_to' => $settings->certificate_valid_to?->toDateString(),
            ] : null,
            'stats' => [
                'users' => User::query()->where('company_id', $company->id)->count(),
                'establishments' => $company->establishments->count(),
                'series' => DocumentSeries::query()->withoutGlobalScopes()->where('company_id', $company->id)->count(),
            ],
            'admins' => User::query()
                ->where('company_id', $company->id)
                ->whereHas('roles', fn (Builder $q) => $q->where('name', UserRole::CompanyAdmin->value))
                ->get(['id', 'first_name', 'last_name', 'email', 'is_active'])
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'is_active' => $u->is_active]),
            'plans' => $subscriptions->plans(),
            // La suscripción se consulta a la API solo cuando se abre la pestaña (prop diferida).
            'subscription' => Inertia::defer(fn () => $connected ? $subscriptions->overview($company) : null),
            'billingStatuses' => array_map(fn (BillingStatus $s) => ['value' => $s->value, 'label' => $s->label()], BillingStatus::cases()),
        ]);
    }

    public function update(Request $request, Company $company, ActivityLogger $activity): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        $company->forceFill(['status' => $validated['status']])->save();

        $activity->log(
            $validated['status'] === Company::STATUS_ACTIVE ? 'company.activated' : 'company.suspended',
            ($validated['status'] === Company::STATUS_ACTIVE ? 'Se reactivó' : 'Se suspendió').' el taller '.$company->legal_name.'.',
            $company,
            company: $company,
        );

        $this->toastSuccess($validated['status'] === Company::STATUS_ACTIVE ? 'Taller reactivado.' : 'Taller suspendido: sus usuarios ya no pueden ingresar.');

        return back();
    }
}
