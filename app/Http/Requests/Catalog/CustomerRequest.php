<?php

namespace App\Http\Requests\Catalog;

use App\Enums\IdentityDocumentType;
use App\Models\Customer;
use App\Rules\ValidRuc;
use App\Support\Tenancy\CurrentCompany;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        $customer = $this->route('customer');

        return $customer instanceof Customer
            ? $this->user()->can('update', $customer)
            : $this->user()->can('create', Customer::class);
    }

    protected function prepareForValidation(): void
    {
        $number = $this->input('document_number');
        $type = $this->input('document_type');

        $this->merge([
            'document_number' => is_string($number) && $number !== '' ? Str::upper(preg_replace('/\s+/', '', $number)) : null,
            'name' => is_string($this->input('name')) ? Str::squish(Str::upper($this->input('name'))) : $this->input('name'),
            'address' => is_string($this->input('address')) ? Str::squish(Str::upper($this->input('address'))) : $this->input('address'),
            'email' => is_string($this->input('email')) ? Str::lower(trim($this->input('email'))) : $this->input('email'),
            'document_type' => $type === null || $type === '' ? null : (string) $type,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Customer|null $customer */
        $customer = $this->route('customer');
        $type = IdentityDocumentType::tryFrom((string) $this->input('document_type'));

        return [
            'document_type' => ['required', Rule::enum(IdentityDocumentType::class)],
            'document_number' => [
                $type === IdentityDocumentType::None ? 'nullable' : 'required',
                'string',
                'max:15',
                function (string $attribute, mixed $value, Closure $fail) use ($type): void {
                    if ($value === null || $type === null) {
                        return;
                    }

                    $rule = $type->numberRule();
                    if ($rule !== null && ! preg_match($rule, (string) $value)) {
                        $fail(match ($type) {
                            IdentityDocumentType::Dni => 'El DNI debe tener 8 dígitos.',
                            IdentityDocumentType::Ruc => 'El RUC debe tener 11 dígitos.',
                            default => 'El número de documento no tiene un formato válido.',
                        });

                        return;
                    }

                    if ($type === IdentityDocumentType::Ruc && ! ValidRuc::isValid((string) $value)) {
                        $fail('El RUC no es válido (dígito verificador incorrecto).');
                    }
                },
                Rule::unique('customers', 'document_number')
                    ->where('company_id', app(CurrentCompany::class)->id())
                    ->where('document_type', $this->input('document_type'))
                    ->ignore($customer?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'document_type' => 'tipo de documento',
            'document_number' => 'número de documento',
            'name' => 'nombre o razón social',
            'trade_name' => 'nombre comercial',
            'address' => 'dirección',
            'phone' => 'teléfono',
            'email' => 'correo',
            'notes' => 'notas',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['document_number.unique' => 'Ya existe un cliente con ese documento (puede estar eliminado).'];
    }
}
