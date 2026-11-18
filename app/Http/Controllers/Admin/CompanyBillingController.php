<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProvisionCompanyRequest;
use App\Models\Company;
use App\Models\CompanyBillingSetting;
use App\Services\Audit\ActivityLogger;
use App\Services\SunatApi\CompanyConfigSync;
use App\Services\SunatApi\CompanyProvisioner;
use App\Services\SunatApi\CredentialManager;
use App\Services\SunatApi\Exceptions\SunatApiException;
use App\Services\SunatApi\SubscriptionManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Configuración de la API de facturación de un taller. Todas estas acciones
 * son exclusivas del super admin (middleware role:super_admin).
 */
class CompanyBillingController extends Controller
{
    public function __construct(private readonly ActivityLogger $activity) {}

    /**
     * Registro del taller en la API (POST /registro) + sincronización inicial.
     */
    public function provision(ProvisionCompanyRequest $request, Company $company, CompanyProvisioner $provisioner): RedirectResponse
    {
        $company->load('billingSettings');

        if ($company->billingSettings->hasCredentials()) {
            return back()->withErrors(['api' => 'El taller ya está registrado en la API. Use "Reintentar sincronización" o "Renovar certificado".']);
        }

        try {
            $provisioner->register($company, $request->file('certificate'), [
                'sol_user' => $request->string('sol_user')->toString(),
                'sol_pass' => $request->string('sol_pass')->toString(),
                'certificate_password' => $request->string('certificate_password')->toString(),
                'client_id' => $request->input('client_id'),
                'client_secret' => $request->input('client_secret'),
            ]);
        } catch (SunatApiException $e) {
            $this->activity->log('billing.provision_failed', "Falló el registro del taller {$company->legal_name} en la API.", $company, ['error' => $e->userMessage()], company: $company);

            return $this->backWithApiError($e, 'No se pudo completar el registro en la API');
        }

        if ($request->filled('client_id')) {
            $company->billingSettings->forceFill(['sunat_client_id' => $request->input('client_id')])->save();
        }

        $this->activity->log('billing.provisioned', "Taller {$company->legal_name} registrado en la API de facturación.", $company, company: $company);
        $this->toastSuccess('Taller registrado en la API de facturación y configuración sincronizada.');

        return back();
    }

    /**
     * Reintenta la sincronización (empresa, sucursales, series) tras un error parcial.
     */
    public function synchronize(Company $company, CompanyProvisioner $provisioner): RedirectResponse
    {
        $company->load('billingSettings');

        try {
            $provisioner->synchronize($company);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'La sincronización no se completó');
        }

        $this->activity->log('billing.synchronized', "Configuración del taller {$company->legal_name} sincronizada con la API.", $company, company: $company);
        $this->toastSuccess('Configuración sincronizada con la API.');

        return back();
    }

    /**
     * Sube o renueva el certificado digital (no se guarda en el sistema).
     */
    public function certificate(Request $request, Company $company, CompanyConfigSync $sync): RedirectResponse
    {
        $request->validate([
            'certificate' => ['required', 'file', 'extensions:pfx,p12', 'max:2048'],
            'certificate_password' => ['required', 'string', 'max:255'],
        ], ['certificate.extensions' => 'El certificado debe ser un archivo .pfx o .p12.'], [
            'certificate' => 'certificado digital',
            'certificate_password' => 'contraseña del certificado',
        ]);

        $company->load('billingSettings');

        try {
            $sync->uploadCertificate($company, $request->file('certificate'), $request->string('certificate_password')->toString());
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'La API rechazó el certificado');
        }

        $this->activity->log('billing.certificate_uploaded', "Se actualizó el certificado digital del taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess('Certificado actualizado en la API.');

        return back();
    }

    /**
     * Activa la suscripción o cambia el plan del taller.
     */
    public function plan(Request $request, Company $company, SubscriptionManager $subscriptions): RedirectResponse
    {
        $validated = $request->validate([
            'plan' => ['required', 'string', 'max:30', 'alpha_dash'],
            'cycle' => ['required', 'in:monthly,yearly'],
            'action' => ['required', 'in:activate,change'],
            'trial' => ['boolean'],
        ]);

        $company->load('billingSettings');

        if (! $company->billingSettings->hasCredentials()) {
            // Aún no registrado: el plan se enviará en /registro.
            $company->forceFill(['api_plan' => $validated['plan']])->save();
            $this->toastSuccess('Plan asignado. Se aplicará al registrar el taller en la API.');

            return back();
        }

        try {
            $validated['action'] === 'activate'
                ? $subscriptions->activate($company, $validated['plan'], $validated['cycle'], (bool) ($validated['trial'] ?? false))
                : $subscriptions->changePlan($company, $validated['plan'], $validated['cycle']);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo actualizar la suscripción');
        }

        $this->activity->log('billing.plan_changed', "Plan del taller {$company->legal_name}: {$validated['plan']} ({$validated['cycle']}).", $company, $validated, company: $company);
        $this->toastSuccess('Suscripción actualizada.');

        return back();
    }

    public function cancelSubscription(Company $company, SubscriptionManager $subscriptions): RedirectResponse
    {
        $company->load('billingSettings');

        try {
            $subscriptions->cancel($company);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo cancelar la suscripción');
        }

        $this->activity->log('billing.subscription_cancelled', "Se canceló la suscripción del taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess('Suscripción cancelada.');

        return back();
    }

    /**
     * Cambia el entorno beta ⇄ producción (exige escribir el RUC como confirmación).
     */
    public function environment(Request $request, Company $company, CompanyConfigSync $sync): RedirectResponse
    {
        $validated = $request->validate([
            'environment' => ['required', Rule::in(CompanyBillingSetting::ENVIRONMENTS)],
            'confirmation' => ['required', Rule::in([$company->ruc])],
        ], ['confirmation.in' => 'Escriba el RUC del taller para confirmar.']);

        $company->load('billingSettings');
        $settings = $company->billingSettings;
        $previous = $settings->environment;

        if ($previous === $validated['environment']) {
            return back();
        }

        try {
            DB::transaction(function () use ($company, $settings, $validated, $sync): void {
                $settings->forceFill([
                    'environment' => $validated['environment'],
                    'environment_changed_at' => now(),
                    'environment_changed_by' => auth()->id(),
                ])->save();

                if ($settings->hasCredentials()) {
                    $sync->pushEnvironment($company, $validated['environment']);
                }
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo cambiar el entorno');
        }

        $label = $validated['environment'] === 'production' ? 'PRODUCCIÓN' : 'BETA (pruebas)';
        $this->activity->log('billing.environment_changed', "Entorno del taller {$company->legal_name}: {$previous} → {$validated['environment']}.", $company, ['from' => $previous, 'to' => $validated['environment']], company: $company);
        $this->toastSuccess("El taller ahora emite en {$label}.");

        return back();
    }

    /**
     * Opciones avanzadas: tasa IGV forzada y credenciales del API REST de SUNAT.
     */
    public function advanced(Request $request, Company $company, CompanyConfigSync $sync): RedirectResponse
    {
        $validated = $request->validate([
            'igv_rate_override' => ['nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
            'client_id' => ['nullable', 'string', 'max:255'],
            'client_secret' => ['nullable', 'string', 'max:255'],
        ], [], ['igv_rate_override' => 'tasa de IGV', 'client_id' => 'client ID', 'client_secret' => 'client secret']);

        $company->load('billingSettings');
        $settings = $company->billingSettings;

        if (! $settings->hasCredentials()) {
            return back()->withErrors(['api' => 'Primero registre el taller en la API.']);
        }

        $override = isset($validated['igv_rate_override']) ? (float) $validated['igv_rate_override'] : null;

        try {
            DB::transaction(function () use ($company, $settings, $validated, $override, $sync): void {
                $settings->forceFill([
                    'igv_rate_override' => $override,
                    'sunat_client_id' => $validated['client_id'] ?: $settings->sunat_client_id,
                ])->save();

                $sync->pushAdvanced($company, $override, $validated['client_id'] ?? null, $validated['client_secret'] ?? null);
            });
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se guardaron las opciones avanzadas');
        }

        $this->activity->log('billing.advanced_updated', "Opciones avanzadas de facturación del taller {$company->legal_name} actualizadas.", $company, ['igv_rate_override' => $override], company: $company);
        $this->toastSuccess('Opciones avanzadas guardadas.');

        return back();
    }

    /**
     * Prueba de conexión: health de la API, credenciales (GET /empresa) y estado de SUNAT.
     */
    public function test(Company $company, CredentialManager $credentials): RedirectResponse
    {
        $company->load('billingSettings');

        if (! $company->billingSettings->hasCredentials()) {
            return back()->withErrors(['api' => 'El taller todavía no está registrado en la API.']);
        }

        $checks = $credentials->testConnection($company);
        $ok = collect($checks)->every(fn ($c) => $c['ok']);

        Inertia::flash('connectionChecks', $checks);
        Inertia::flash('toast', ['type' => $ok ? 'success' : 'error', 'message' => $ok ? 'Conexión correcta.' : 'La prueba de conexión encontró problemas.']);

        return back();
    }

    public function regenerateCredentials(Company $company, CredentialManager $credentials): RedirectResponse
    {
        $company->load('billingSettings');

        try {
            $credentials->regenerate($company);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudieron regenerar las credenciales');
        }

        $this->activity->log('billing.credentials_regenerated', "Se regeneraron las credenciales de la API del taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess('Credenciales regeneradas y guardadas de forma segura.');

        return back();
    }

    public function requestRecovery(Company $company, CredentialManager $credentials): RedirectResponse
    {
        $company->load('billingSettings');

        try {
            $credentials->requestRecovery($company);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo solicitar la recuperación');
        }

        $this->activity->log('billing.credentials_recovery_requested', "Se solicitó recuperar las credenciales de la API del taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess('La API envió un token de recuperación al correo registrado del taller.');

        return back();
    }

    public function verifyRecovery(Request $request, Company $company, CredentialManager $credentials): RedirectResponse
    {
        $validated = $request->validate(['token' => ['required', 'string', 'size:64']], [], ['token' => 'token']);
        $company->load('billingSettings');

        try {
            $credentials->verifyRecovery($company, $validated['token']);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'El token no fue aceptado');
        }

        $this->activity->log('billing.credentials_recovered', "Se recuperaron las credenciales de la API del taller {$company->legal_name}.", $company, company: $company);
        $this->toastSuccess('Credenciales recuperadas. Ejecute "Reintentar sincronización" si el registro había quedado incompleto.');

        return back();
    }

    /**
     * Elimina el tenant en la API (irreversible). Exige escribir el RUC.
     */
    public function destroyTenant(Request $request, Company $company, CredentialManager $credentials): RedirectResponse
    {
        $request->validate(['confirmation' => ['required', Rule::in([$company->ruc])]], ['confirmation.in' => 'Escriba el RUC del taller para confirmar.']);
        $company->load('billingSettings');

        try {
            $credentials->deleteTenant($company);
        } catch (SunatApiException $e) {
            return $this->backWithApiError($e, 'No se pudo eliminar el taller en la API');
        }

        $this->activity->log('billing.tenant_deleted', "Se eliminó el taller {$company->legal_name} de la API de facturación.", $company, company: $company);
        $this->toastSuccess('Taller eliminado de la API. Puede volver a registrarlo cuando lo necesite.');

        return back();
    }
}
