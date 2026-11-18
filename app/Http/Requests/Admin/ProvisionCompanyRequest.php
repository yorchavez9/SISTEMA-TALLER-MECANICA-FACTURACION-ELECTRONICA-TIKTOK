<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Registro del taller en la API: certificado + Clave SOL. Estos datos se
 * reenvían a la API y no se guardan en el sistema.
 */
class ProvisionCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isSuperAdmin();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'certificate' => ['required', 'file', 'extensions:pfx,p12', 'max:2048'],
            'certificate_password' => ['required', 'string', 'max:255'],
            'sol_user' => ['required', 'string', 'max:50'],
            'sol_pass' => ['required', 'string', 'max:100'],
            'client_id' => ['nullable', 'string', 'max:255'],
            'client_secret' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'certificate' => 'certificado digital',
            'certificate_password' => 'contraseña del certificado',
            'sol_user' => 'usuario SOL',
            'sol_pass' => 'clave SOL',
            'client_id' => 'client ID de SUNAT',
            'client_secret' => 'client secret de SUNAT',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['certificate.extensions' => 'El certificado debe ser un archivo .pfx o .p12.'];
    }
}
