<?php

namespace App\Http\Requests\Catalog;

use App\Enums\IgvAffectation;
use App\Models\Service;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $service = $this->route('service');

        return $service instanceof Service
            ? $this->user()->can('update', $service)
            : $this->user()->can('create', Service::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'numeric', 'min:0', 'max:9999999', 'decimal:0,2'],
            'igv_affectation' => ['required', Rule::enum(IgvAffectation::class)],
            'sunat_product_code' => ['nullable', 'digits:8'],
            'subject_to_detraction' => ['boolean'],
            'detraction_type_id' => [
                'nullable', 'integer',
                Rule::exists('detraction_types', 'id')->where('company_id', app(CurrentCompany::class)->id()),
            ],
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nombre',
            'description' => 'descripción',
            'price' => 'precio',
            'igv_affectation' => 'afectación IGV',
            'sunat_product_code' => 'código de producto SUNAT',
            'detraction_type_id' => 'tipo de detracción',
        ];
    }
}
