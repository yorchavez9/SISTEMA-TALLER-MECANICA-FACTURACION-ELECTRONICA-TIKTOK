<?php

namespace App\Http\Requests\CompanySettings;

use App\Models\Establishment;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class EstablishmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('company_settings.manage');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'address' => is_string($this->input('address')) ? mb_strtoupper(trim($this->input('address'))) : $this->input('address'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Establishment|null $establishment */
        $establishment = $this->route('establishment');
        $companyId = app(CurrentCompany::class)->id();

        return [
            'name' => ['required', 'string', 'max:100'],
            'local_code' => [
                'required', 'digits:4',
                Rule::unique('establishments', 'local_code')->where('company_id', $companyId)->ignore($establishment?->id),
            ],
            'address' => ['required', 'string', 'max:255'],
            'ubigeo' => ['required', 'digits:6'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nombre',
            'local_code' => 'código de establecimiento',
            'address' => 'dirección',
            'ubigeo' => 'ubigeo',
            'phone' => 'teléfono',
            'email' => 'correo',
        ];
    }
}
