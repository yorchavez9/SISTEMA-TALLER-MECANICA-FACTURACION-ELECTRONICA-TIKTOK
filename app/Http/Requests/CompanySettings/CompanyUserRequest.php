<?php

namespace App\Http\Requests\CompanySettings;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\Tenancy\CurrentCompany;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Usuarios del taller. El rol super_admin nunca puede asignarse desde aquí.
 */
class CompanyUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Un usuario de otro taller responde 404 antes de validar nada.
        $target = $this->route('user');
        if ($target instanceof User && $target->company_id !== app(CurrentCompany::class)->id()) {
            abort(404);
        }

        return (bool) $this->user()?->can('company_users.manage');
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->input('email')) ? mb_strtolower(trim($this->input('email'))) : $this->input('email'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var User|null $user */
        $user = $this->route('user');

        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'last_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'email' => ['required', 'email', 'max:255', Rule::unique(User::class, 'email')->ignore($user?->id)],
            'role' => ['required', Rule::in(self::assignableRoles())],
            // Obligatoria al crear; al editar, solo si se quiere cambiar.
            'password' => [$user ? 'nullable' : 'required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * @return list<string>
     */
    public static function assignableRoles(): array
    {
        return [UserRole::CompanyAdmin->value, UserRole::Cashier->value, UserRole::Mechanic->value];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'email' => 'correo',
            'role' => 'rol',
            'password' => 'contraseña',
        ];
    }
}
