<?php

namespace App\Http\Controllers\CompanySettings;

use App\Http\Controllers\Controller;
use App\Services\SunatApi\SubscriptionManager;
use App\Support\Tenancy\CurrentCompany;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Estado de la facturación electrónica del taller (solo lectura). Plan,
 * entorno y certificado los gestiona el super admin.
 */
class BillingStatusController extends Controller
{
    public function __invoke(CurrentCompany $current, SubscriptionManager $subscriptions): Response
    {
        $company = $current->getOrFail()->load('billingSettings');
        $s = $company->billingSettings;
        $connected = $s->hasCredentials();

        return Inertia::render('company-settings/billing', [
            'billing' => [
                'status' => $s->status->value,
                'status_label' => $s->status->label(),
                'connected' => $connected,
                'environment' => $s->environment,
                'plan' => $company->api_plan,
                'igv_rate' => $s->igv_rate,
                'provisioned_at' => $s->provisioned_at?->toIso8601String(),
                'last_synced_at' => $s->last_synced_at?->toIso8601String(),
                'certificate_uploaded_at' => $s->certificate_uploaded_at?->toIso8601String(),
                'certificate_valid_to' => $s->certificate_valid_to?->toDateString(),
                'last_error' => $s->last_error,
            ],
            'usage' => Inertia::defer(fn () => $connected ? $subscriptions->overview($company)['usage'] : null),
        ]);
    }
}
