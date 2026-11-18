<?php

namespace App\Http\Requests\WorkOrders;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\WorkOrder;
use App\Support\Tenancy\CurrentCompany;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Alta y edición de la cabecera de una OT. Cliente y vehículo solo se eligen
 * al crearla; el vehículo debe pertenecer al cliente y ambos al taller.
 */
class WorkOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $order = $this->route('workOrder');

        return $order instanceof WorkOrder
            ? $this->user()->can('update', $order)
            : $this->user()->can('create', WorkOrder::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $companyId = app(CurrentCompany::class)->id();
        $creating = ! $this->route('workOrder') instanceof WorkOrder;

        $rules = [
            'assigned_user_id' => [
                'nullable', 'integer',
                function (string $attribute, mixed $value, Closure $fail) use ($companyId): void {
                    $ok = User::query()
                        ->whereKey($value)
                        ->where('company_id', $companyId)
                        ->where('is_active', true)
                        ->exists();

                    if (! $ok) {
                        $fail('El técnico seleccionado no es válido.');
                    }
                },
            ],
            'mileage_in' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'reported_problem' => ['required', 'string', 'min:3', 'max:5000'],
            'diagnosis' => ['nullable', 'string', 'max:5000'],
            'observations' => ['nullable', 'string', 'max:5000'],
            // Al crear, la fecha prometida no puede estar en el pasado; al editar se
            // acepta una fecha ya vencida (la orden puede estar atrasada).
            'promised_at' => $creating
                ? ['nullable', 'date', 'after_or_equal:today']
                : ['nullable', 'date'],
        ];

        if ($creating) {
            $rules['customer_id'] = ['required', 'integer', Rule::exists('customers', 'id')->where('company_id', $companyId)->whereNull('deleted_at')];
            $rules['vehicle_id'] = [
                'required', 'integer',
                Rule::exists('vehicles', 'id')
                    ->where('company_id', $companyId)
                    ->where('customer_id', (int) $this->input('customer_id'))
                    ->whereNull('deleted_at'),
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
            'vehicle_id' => 'vehículo',
            'assigned_user_id' => 'técnico',
            'mileage_in' => 'kilometraje de ingreso',
            'reported_problem' => 'problema reportado',
            'diagnosis' => 'diagnóstico',
            'observations' => 'observaciones',
            'promised_at' => 'fecha prometida',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['vehicle_id.exists' => 'El vehículo no pertenece al cliente seleccionado.'];
    }

    /**
     * Técnicos asignables del taller (activos).
     *
     * @return list<array{value: string, label: string}>
     */
    public static function mechanicOptions(int $companyId): array
    {
        return User::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('name', [UserRole::Mechanic->value, UserRole::CompanyAdmin->value]))
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name'])
            ->map(fn (User $u) => ['value' => (string) $u->id, 'label' => $u->name])
            ->all();
    }
}
