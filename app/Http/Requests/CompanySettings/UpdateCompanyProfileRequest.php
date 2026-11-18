<?php

namespace App\Http\Requests\CompanySettings;

use App\Http\Requests\Concerns\FiscalDataRules;
use App\Models\Company;
use App\Rules\ValidRuc;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Datos de empresa y fiscales editables por el administrador del taller.
 * El RUC solo puede cambiarse mientras el taller no esté registrado en la API.
 */
class UpdateCompanyProfileRequest extends FormRequest
{
    use FiscalDataRules;

    public function authorize(): bool
    {
        return (bool) $this->user()?->can('company_settings.manage');
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeFiscalInput();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $company = app(CurrentCompany::class)->getOrFail();
        $locked = $company->billingSettings?->hasCredentials() ?? false;

        return [
            'ruc' => $locked
                ? ['required', Rule::in([$company->ruc])]
                : ['required', 'digits:11', new ValidRuc, Rule::unique(Company::class, 'ruc')->ignore($company->id)],
            'legal_name' => ['required', 'string', 'max:255'],
            ...$this->fiscalRules(),
            'thanks_message' => ['nullable', 'string', 'max:200'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return $this->fiscalAttributes();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['ruc.in' => 'El RUC no puede cambiarse porque el taller ya está registrado en la API de facturación.'];
    }
}
