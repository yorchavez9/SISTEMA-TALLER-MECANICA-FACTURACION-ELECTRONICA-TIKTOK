<?php

namespace App\Http\Requests\Concerns;

use App\Enums\TaxRegime;
use Illuminate\Validation\Rule;

/**
 * Reglas compartidas de datos fiscales del emisor.
 */
trait FiscalDataRules
{
    /**
     * @return array<string, mixed>
     */
    protected function fiscalRules(): array
    {
        return [
            'trade_name' => ['nullable', 'string', 'max:150'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'fiscal_address' => ['required', 'string', 'max:255'],
            'ubigeo' => ['required', 'digits:6'],
            'department' => ['required', 'string', 'max:60'],
            'province' => ['required', 'string', 'max:60'],
            'district' => ['required', 'string', 'max:60'],
            'tax_regime' => ['required', Rule::enum(TaxRegime::class)],
            'nrus_category' => ['nullable', 'required_if:tax_regime,rus', 'in:1,2'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function fiscalAttributes(): array
    {
        return [
            'ruc' => 'RUC',
            'legal_name' => 'razón social',
            'trade_name' => 'nombre comercial',
            'email' => 'correo',
            'phone' => 'teléfono',
            'fiscal_address' => 'dirección fiscal',
            'ubigeo' => 'ubigeo',
            'department' => 'departamento',
            'province' => 'provincia',
            'district' => 'distrito',
            'tax_regime' => 'régimen tributario',
            'nrus_category' => 'categoría NRUS',
            'thanks_message' => 'mensaje de agradecimiento',
        ];
    }

    protected function normalizeFiscalInput(): void
    {
        $upper = fn ($v) => is_string($v) ? mb_strtoupper(trim($v)) : $v;
        $trim = fn ($v) => is_string($v) ? trim($v) : $v;

        $this->merge([
            'ruc' => $trim($this->input('ruc')),
            'legal_name' => $upper($this->input('legal_name')),
            'trade_name' => $trim($this->input('trade_name')),
            'fiscal_address' => $upper($this->input('fiscal_address')),
            'department' => $upper($this->input('department')),
            'province' => $upper($this->input('province')),
            'district' => $upper($this->input('district')),
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : $this->input('email'),
        ]);
    }
}
