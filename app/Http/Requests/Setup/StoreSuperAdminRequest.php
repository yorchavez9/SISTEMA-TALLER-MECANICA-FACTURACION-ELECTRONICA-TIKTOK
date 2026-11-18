<?php

namespace App\Http\Requests\Setup;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreSuperAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // El acceso lo controla el middleware RedirectIfInstalled.
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'first_name' => is_string($this->input('first_name')) ? Str::squish($this->input('first_name')) : $this->input('first_name'),
            'last_name' => is_string($this->input('last_name')) ? Str::squish($this->input('last_name')) : $this->input('last_name'),
            'email' => is_string($this->input('email')) ? Str::lower(trim($this->input('email'))) : $this->input('email'),
        ]);
    }

    /**
     * Solo se aceptan estos campos; cualquier otro (por ejemplo "role") se
     * ignora porque el controlador usa únicamente los datos validados.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'last_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s'.-]+$/u"],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class, 'email')],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'first_name' => 'nombres',
            'last_name' => 'apellidos',
            'email' => 'correo electrónico',
            'password' => 'contraseña',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'first_name.regex' => 'Los nombres solo pueden contener letras y espacios.',
            'last_name.regex' => 'Los apellidos solo pueden contener letras y espacios.',
        ];
    }
}
