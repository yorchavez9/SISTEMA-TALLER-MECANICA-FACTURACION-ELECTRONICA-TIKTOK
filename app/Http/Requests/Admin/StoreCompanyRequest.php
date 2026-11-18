<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\FiscalDataRules;
use App\Models\Company;
use App\Models\CompanyBillingSetting;
use App\Models\User;
use App\Rules\ValidRuc;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreCompanyRequest extends FormRequest
{
    use FiscalDataRules;

    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    protected function prepareForValidation(): void
    {
        $this->normalizeFiscalInput();
        $this->merge([
            'admin_email' => is_string($this->input('admin_email')) ? mb_strtolower(trim($this->input('admin_email'))) : $this->input('admin_email'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'ruc' => ['required', 'digits:11', new ValidRuc, Rule::unique(Company::class, 'ruc')],
            'legal_name' => ['required', 'string', 'max:255'],
            ...$this->fiscalRules(),
            'api_plan' => ['required', 'string', 'max:30', 'alpha_dash'],
            'environment' => ['required', Rule::in(CompanyBillingSetting::ENVIRONMENTS)],
            'admin_first_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'admin_last_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'admin_email' => ['required', 'email', 'max:255', Rule::unique(User::class, 'email')],
            'admin_password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            ...$this->fiscalAttributes(),
            'api_plan' => 'plan',
            'environment' => 'entorno',
            'admin_first_name' => 'nombres del administrador',
            'admin_last_name' => 'apellidos del administrador',
            'admin_email' => 'correo del administrador',
            'admin_password' => 'contraseña del administrador',
        ];
    }
}
