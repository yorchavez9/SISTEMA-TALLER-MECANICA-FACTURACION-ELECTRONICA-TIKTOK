<?php

namespace App\Http\Requests\WorkOrders;

use App\Models\WorkOrder;
use App\Models\WorkOrderItem;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Ítem de la OT. Al crear se indica el tipo y el servicio/producto; al editar
 * solo cambian descripción, cantidad y precio.
 */
class WorkOrderItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var WorkOrder $order */
        $order = $this->route('workOrder');

        return $this->user()->can('update', $order);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('description'))) {
            $this->merge(['description' => trim($this->input('description'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $companyId = app(CurrentCompany::class)->id();
        $editing = $this->route('item') instanceof WorkOrderItem;
        $type = $this->input('type');

        $rules = [
            'description' => [$editing || $type === 'labor' ? 'required' : 'nullable', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:99999', 'decimal:0,3'],
            'unit_price' => [$editing || $type === 'labor' ? 'required' : 'nullable', 'numeric', 'min:0', 'max:9999999', 'decimal:0,2'],
        ];

        if (! $editing) {
            $rules['type'] = ['required', Rule::in(array_keys(WorkOrderItem::TYPES))];
            $rules['service_id'] = [
                'nullable', 'required_if:type,service', 'integer',
                Rule::exists('services', 'id')->where('company_id', $companyId)->where('is_active', true)->whereNull('deleted_at'),
            ];
            $rules['product_id'] = [
                'nullable', 'required_if:type,product', 'integer',
                Rule::exists('products', 'id')->where('company_id', $companyId)->where('is_active', true)->whereNull('deleted_at'),
            ];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'type' => 'tipo',
            'service_id' => 'servicio',
            'product_id' => 'repuesto',
            'description' => 'descripción',
            'quantity' => 'cantidad',
            'unit_price' => 'precio unitario',
        ];
    }
}
