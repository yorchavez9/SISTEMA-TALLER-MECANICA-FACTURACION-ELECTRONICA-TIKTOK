<?php

namespace App\Http\Controllers\CompanySettings;

use App\Http\Controllers\Controller;
use App\Http\Requests\CompanySettings\DetractionTypeRequest;
use App\Models\DetractionType;
use App\Services\Audit\ActivityLogger;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Detracción: configuración general (cuenta, medio de pago, umbral) y los
 * tipos con su porcentaje, que el taller agrega y edita libremente. Al emitir
 * cada factura el usuario elige el tipo y el % (Fase 6).
 */
class DetractionController extends Controller
{
    public function __construct(
        private readonly CurrentCompany $current,
        private readonly ActivityLogger $activity,
    ) {}

    public function index(): Response
    {
        $s = $this->current->getOrFail()->load('billingSettings')->billingSettings;

        return Inertia::render('company-settings/detraction', [
            'settings' => [
                'detraction_enabled' => $s->detraction_enabled,
                'detraction_account' => $s->detraction_account,
                'detraction_payment_method' => $s->detraction_payment_method,
                'detraction_threshold' => $s->detraction_threshold,
            ],
            'types' => DetractionType::query()->orderByDesc('is_default')->orderBy('code')->get()
                ->map(fn (DetractionType $t) => [
                    'id' => $t->id,
                    'code' => $t->code,
                    'description' => $t->description,
                    'rate' => $t->rate,
                    'is_active' => $t->is_active,
                    'is_default' => $t->is_default,
                ]),
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'detraction_enabled' => ['required', 'boolean'],
            'detraction_account' => ['nullable', 'required_if:detraction_enabled,true', 'string', 'max:30', 'regex:/^[0-9-]{6,30}$/'],
            'detraction_payment_method' => ['required', 'digits:3'],
            'detraction_threshold' => ['required', 'numeric', 'min:0', 'max:99999999', 'decimal:0,2'],
        ], [
            'detraction_account.required_if' => 'Ingrese la cuenta de detracciones del Banco de la Nación.',
            'detraction_account.regex' => 'La cuenta solo puede contener números y guiones.',
        ], [
            'detraction_account' => 'cuenta de detracciones',
            'detraction_payment_method' => 'medio de pago',
            'detraction_threshold' => 'monto mínimo',
        ]);

        $company = $this->current->getOrFail()->load('billingSettings');
        $company->billingSettings->fill($validated)->save();

        $this->activity->log('detraction.settings_updated', 'Se actualizó la configuración de detracción.', $company->billingSettings);
        $this->toastSuccess('Configuración de detracción guardada.');

        return back();
    }

    public function store(DetractionTypeRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $type = DB::transaction(function () use ($data): DetractionType {
            if (! empty($data['is_default'])) {
                DetractionType::query()->update(['is_default' => false]);
            }

            return DetractionType::query()->create([
                ...$data,
                'is_active' => $data['is_active'] ?? true,
                'is_default' => $data['is_default'] ?? false,
            ]);
        });

        $this->activity->log('detraction.type_created', "Se agregó el tipo de detracción {$type->code} ({$type->rate} %).", $type);
        $this->toastSuccess('Tipo de detracción agregado.');

        return back();
    }

    public function update(DetractionTypeRequest $request, DetractionType $detractionType): RedirectResponse
    {
        abort_unless($detractionType->company_id === $this->current->id(), 404);
        $data = $request->validated();

        DB::transaction(function () use ($data, $detractionType): void {
            if (! empty($data['is_default'])) {
                DetractionType::query()->whereKeyNot($detractionType->id)->update(['is_default' => false]);
            }

            $detractionType->fill($data)->save();
        });

        $this->activity->log('detraction.type_updated', "Se actualizó el tipo de detracción {$detractionType->code} ({$detractionType->rate} %).", $detractionType);
        $this->toastSuccess('Tipo de detracción actualizado.');

        return back();
    }
}
