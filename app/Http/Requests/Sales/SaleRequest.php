<?php

namespace App\Http\Requests\Sales;

use App\Enums\PaymentMethod;
use App\Models\Sale;
use App\Models\WorkOrder;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Venta directa (con ítems) o desde una OT (solo pagos y notas: los ítems
 * salen de la OT). Los montos los recalcula el servidor.
 */
class SaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('workOrder');

        if ($order instanceof WorkOrder && ! $this->user()->can('view', $order)) {
            return false;
        }

        return $this->user()->can('create', Sale::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $companyId = app(CurrentCompany::class)->id();
        $fromWorkOrder = $this->route('workOrder') instanceof WorkOrder;

        $rules = [
            'payments' => ['present', 'array', 'max:10'],
            'payments.*.method' => ['required', Rule::enum(PaymentMethod::class)],
            'payments.*.amount' => ['required', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            'payments.*.reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];

        if (! $fromWorkOrder) {
            $rules += [
                'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('company_id', $companyId)->whereNull('deleted_at')],
                'items' => ['required', 'array', 'min:1', 'max:100'],
                'items.*.type' => ['required', Rule::in(['service', 'product', 'labor'])],
                'items.*.service_id' => [
                    'nullable', 'required_if:items.*.type,service', 'integer',
                    Rule::exists('services', 'id')->where('company_id', $companyId)->where('is_active', true)->whereNull('deleted_at'),
                ],
                'items.*.product_id' => [
                    'nullable', 'required_if:items.*.type,product', 'integer',
                    Rule::exists('products', 'id')->where('company_id', $companyId)->where('is_active', true)->whereNull('deleted_at'),
                ],
                'items.*.description' => ['nullable', 'required_if:items.*.type,labor', 'string', 'max:255'],
                'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:99999', 'decimal:0,3'],
                'items.*.unit_price' => ['nullable', 'required_if:items.*.type,labor', 'numeric', 'min:0', 'max:9999999', 'decimal:0,2'],
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
            'customer_id' => 'cliente',
            'items' => 'ítems',
            'items.*.type' => 'tipo',
            'items.*.service_id' => 'servicio',
            'items.*.product_id' => 'repuesto',
            'items.*.description' => 'descripción',
            'items.*.quantity' => 'cantidad',
            'items.*.unit_price' => 'precio',
            'payments' => 'pagos',
            'payments.*.method' => 'método de pago',
            'payments.*.amount' => 'monto',
            'payments.*.reference' => 'referencia',
            'notes' => 'notas',
        ];
    }
}
