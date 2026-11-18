<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Services\SunatApi\LookupService;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consultas JSON para formularios (ubigeo y RUC/DNI) a través de la API.
 * Nunca exponen credenciales: el backend hace la llamada.
 */
class LookupController extends Controller
{
    public function __construct(
        private readonly LookupService $lookups,
        private readonly CurrentCompany $current,
    ) {}

    public function ubigeo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'level' => ['required', 'in:regions,provinces,districts'],
            'parent' => ['nullable', 'required_unless:level,regions', 'alpha_num', 'max:10'],
            'company' => ['nullable', 'integer'],
        ]);

        $company = $this->company($request);

        $items = match ($validated['level']) {
            'regions' => $this->lookups->regions($company),
            'provinces' => $this->lookups->provinces($company, (string) $validated['parent']),
            'districts' => $this->lookups->districts($company, (string) $validated['parent']),
        };

        return response()->json(['available' => $items !== null, 'items' => $items ?? []]);
    }

    public function document(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:1,6'],
            'number' => ['required', 'string', $request->input('type') === '6' ? 'digits:11' : 'digits:8'],
            'company' => ['nullable', 'integer'],
        ]);

        $data = $this->lookups->document($this->company($request), $validated['type'], $validated['number']);

        if ($data === null) {
            return response()->json(['found' => false]);
        }

        return response()->json([
            'found' => true,
            'name' => $data['razon_social'] ?? $data['nombre'] ?? $data['nombre_completo'] ?? null,
            'trade_name' => $data['nombre_comercial'] ?? null,
            'address' => $data['direccion'] ?? $data['domicilio_fiscal'] ?? null,
            'ubigeo' => $data['ubigeo'] ?? null,
            'department' => $data['departamento'] ?? null,
            'province' => $data['provincia'] ?? null,
            'district' => $data['distrito'] ?? null,
            'status' => $data['estado'] ?? null,
            'condition' => $data['condicion'] ?? null,
        ]);
    }

    /**
     * Empresa cuyas credenciales se usan: la actual, o (solo el super admin)
     * la indicada en ?company=.
     */
    private function company(Request $request): ?Company
    {
        if ($request->filled('company') && $request->user()->isSuperAdmin()) {
            return Company::query()->with('billingSettings')->find($request->integer('company'));
        }

        return $this->current->get()?->load('billingSettings');
    }
}
