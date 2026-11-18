<?php

namespace App\Http\Requests\Catalog;

use App\Enums\IgvAffectation;
use App\Enums\UnitOfMeasure;
use App\Models\Product;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Producto/repuesto. La imagen es opcional: JPG, JPEG, PNG o WEBP de hasta
 * 2 MB; además el servicio de imágenes la re-codifica (descarta archivos
 * manipulados). "remove_image" quita la imagen actual.
 */
class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        $product = $this->route('product');

        return $product instanceof Product
            ? $this->user()->can('update', $product)
            : $this->user()->can('create', Product::class);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'code' => is_string($this->input('code')) ? Str::upper(trim($this->input('code'))) : $this->input('code'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Product|null $product */
        $product = $this->route('product');

        return [
            'code' => [
                'required', 'string', 'max:40', 'regex:/^[A-Z0-9._\/-]+$/',
                Rule::unique('products', 'code')->where('company_id', app(CurrentCompany::class)->id())->ignore($product?->id),
            ],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:9999999', 'decimal:0,2'],
            'sale_price' => ['required', 'numeric', 'min:0', 'max:9999999', 'decimal:0,2'],
            // El stock inicial solo se acepta al crear; luego se usa "Ajustar stock".
            'initial_stock' => $product
                ? ['prohibited']
                : ['nullable', 'numeric', 'min:0', 'max:9999999', 'decimal:0,3'],
            'min_stock' => ['nullable', 'numeric', 'min:0', 'max:9999999', 'decimal:0,3'],
            'unit' => ['required', Rule::in(array_column(UnitOfMeasure::productOptions(), 'value'))],
            'igv_affectation' => ['required', Rule::enum(IgvAffectation::class)],
            'sunat_product_code' => ['nullable', 'digits:8'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048', 'dimensions:max_width=6000,max_height=6000'],
            'remove_image' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'code' => 'código',
            'name' => 'nombre',
            'description' => 'descripción',
            'cost' => 'costo',
            'sale_price' => 'precio de venta',
            'initial_stock' => 'stock inicial',
            'min_stock' => 'stock mínimo',
            'unit' => 'unidad de medida',
            'igv_affectation' => 'afectación IGV',
            'sunat_product_code' => 'código de producto SUNAT',
            'image' => 'imagen',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.regex' => 'El código solo puede tener letras, números, punto, guion o barra.',
            'code.unique' => 'Ya existe un producto con ese código.',
            'image.mimes' => 'La imagen debe ser JPG, JPEG, PNG o WEBP.',
            'image.mimetypes' => 'La imagen debe ser JPG, JPEG, PNG o WEBP.',
            'image.max' => 'La imagen no debe pesar más de 2 MB.',
        ];
    }
}
