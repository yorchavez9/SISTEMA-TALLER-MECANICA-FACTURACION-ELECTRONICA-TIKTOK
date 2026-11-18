<?php

namespace App\Services\SunatApi\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Error base de la integración con la API SUNAT.
 *
 * El mensaje es apto para mostrarse al usuario (nunca contiene secretos).
 */
class SunatApiException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>  $errors  Errores de validación de la API por campo.
     */
    public function __construct(
        string $message,
        public readonly ?int $httpStatus = null,
        public readonly array $errors = [],
        public readonly string $errorType = 'business',
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /**
     * Mensaje completo con el detalle de validación (para mostrar en la UI).
     */
    public function userMessage(): string
    {
        if ($this->errors === []) {
            return $this->getMessage();
        }

        $details = collect($this->errors)->flatten()->filter()->take(5)->implode(' ');

        return trim($this->getMessage().': '.$details);
    }
}
