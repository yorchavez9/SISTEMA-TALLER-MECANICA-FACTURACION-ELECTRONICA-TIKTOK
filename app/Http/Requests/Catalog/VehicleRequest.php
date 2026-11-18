<?php

namespace App\Http\Requests\Catalog;

use App\Models\Vehicle;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class VehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $vehicle = $this->route('vehicle');

        return $vehicle instanceof Vehicle
            ? $this->user()->can('update', $vehicle)
            : $this->user()->can('create', Vehicle::class);
    }

    protected function prepareForValidation(): void
    {
        $upper = fn ($v) => is_string($v) ? Str::squish(Str::upper($v)) : $v;

        $this->merge([
            'plate' => Vehicle::normalizePlate($this->input('plate')),
            'brand' => $upper($this->input('brand')),
            'model' => $upper($this->input('model')),
            'color' => $upper($this->input('color')),
            'vin' => $upper($this->input('vin')),
            'engine_number' => $upper($this->input('engine_number')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Vehicle|null $vehicle */
        $vehicle = $this->route('vehicle');
        $companyId = app(CurrentCompany::class)->id();

        return [
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
            'plate' => [
                'required', 'string', 'regex:/^[A-Z0-9]{5,8}$/',
                Rule::unique('vehicles', 'plate')->where('company_id', $companyId)->ignore($vehicle?->id),
            ],
            'brand' => ['required', 'string', 'max:60'],
            'model' => ['required', 'string', 'max:60'],
            'year' => ['nullable', 'integer', 'min:1950', 'max:'.(now()->year + 1)],
            'color' => ['nullable', 'string', 'max:40'],
            'vin' => ['nullable', 'string', 'max:30'],
            'engine_number' => ['nullable', 'string', 'max:30'],
            'current_mileage' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'features' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'customer_id' => 'cliente',
            'plate' => 'placa',
            'brand' => 'marca',
            'model' => 'modelo',
            'year' => 'año',
            'color' => 'color',
            'vin' => 'VIN / chasis',
            'engine_number' => 'número de motor',
            'current_mileage' => 'kilometraje',
            'features' => 'características',
            'notes' => 'observaciones',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'plate.regex' => 'La placa debe tener entre 5 y 8 letras o números (ej. ABC-123).',
            'plate.unique' => 'Ya existe un vehículo con esa placa.',
        ];
    }
}
