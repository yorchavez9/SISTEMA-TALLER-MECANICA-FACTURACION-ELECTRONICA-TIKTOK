<?php

namespace App\Services\SunatApi;

/**
 * Respuesta de la API SUNAT PRO con el sobre {estado, mensaje, datos, meta, errores}.
 */
final class ApiResponse
{
    /**
     * @param  array<string, mixed>|list<mixed>|null  $datos
     * @param  array<string, mixed>|null  $meta
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public readonly int $status,
        public readonly ?string $estado,
        public readonly ?string $mensaje,
        public readonly array|null $datos,
        public readonly ?array $meta,
        public readonly array $raw,
    ) {}

    /**
     * Busca una clave dentro de "datos" (en cualquier nivel). Se usa porque la
     * colección no documenta la estructura exacta de las respuestas.
     */
    public function find(string ...$keys): mixed
    {
        foreach ($keys as $key) {
            $value = self::search($this->datos ?? [], $key);

            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    /**
     * @param  array<mixed>  $data
     */
    private static function search(array $data, string $key): mixed
    {
        if (array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '') {
            return $data[$key];
        }

        foreach ($data as $value) {
            if (is_array($value)) {
                $found = self::search($value, $key);

                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }
}
