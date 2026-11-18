<?php

namespace App\Http\Requests\CompanySettings;

use App\Enums\DocumentType;
use App\Support\Tenancy\CurrentCompany;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSeriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('company_settings.manage');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'series' => is_string($this->input('series')) ? mb_strtoupper(trim($this->input('series'))) : $this->input('series'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $companyId = app(CurrentCompany::class)->id();

        return [
            'document_type' => ['required', Rule::enum(DocumentType::class)],
            'series' => [
                'required', 'string', 'size:4',
                function (string $attribute, mixed $value, Closure $fail): void {
                    $type = DocumentType::tryFrom((string) $this->input('document_type'));

                    if ($type !== null && ! preg_match($type->seriesPattern(), (string) $value)) {
                        $fail('Serie no válida. '.$type->seriesHint());
                    }
                },
                Rule::unique('document_series', 'series')
                    ->where('company_id', $companyId)
                    ->where('document_type', $this->input('document_type')),
            ],
            'establishment_id' => [
                'required', 'integer',
                Rule::exists('establishments', 'id')->where('company_id', $companyId),
            ],
            'initial_number' => ['nullable', 'integer', 'min:0', 'max:99999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'document_type' => 'tipo de comprobante',
            'series' => 'serie',
            'establishment_id' => 'establecimiento',
            'initial_number' => 'correlativo inicial',
        ];
    }
}
