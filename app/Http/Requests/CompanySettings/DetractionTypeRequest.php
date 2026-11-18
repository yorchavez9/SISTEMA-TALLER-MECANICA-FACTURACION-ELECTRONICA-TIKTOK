<?php

namespace App\Http\Requests\CompanySettings;

use App\Models\DetractionType;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Tipo de detracción con el porcentaje que define el taller.
 */
class DetractionTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('company_settings.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var DetractionType|null $type */
        $type = $this->route('detractionType');

        return [
            'code' => [
                'required', 'digits:3',
                Rule::unique('detraction_types', 'code')->where('company_id', app(CurrentCompany::class)->id())->ignore($type?->id),
            ],
            'description' => ['required', 'string', 'max:150'],
            'rate' => ['required', 'numeric', 'gt:0', 'max:100', 'decimal:0,2'],
            'is_active' => ['boolean'],
            'is_default' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'code' => 'código',
            'description' => 'descripción',
            'rate' => 'porcentaje',
        ];
    }
}
