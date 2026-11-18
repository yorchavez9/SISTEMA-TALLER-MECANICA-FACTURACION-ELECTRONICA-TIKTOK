<?php

namespace App\Services\SunatApi;

use Illuminate\Http\UploadedFile;

/**
 * Elimina datos sensibles antes de guardar solicitudes y respuestas en
 * api_operation_logs: credenciales de la API, Clave SOL, certificado y su
 * contraseña, client_secret de SUNAT y tokens.
 */
final class LogSanitizer
{
    private const MASK = '***';

    private const SENSITIVE_PATTERN = '/(secret|pass|password|contrasena|contraseña|api[_-]?key|token|certificado|certificate|sol_user|authorization)/i';

    /**
     * @param  array<mixed>  $data
     * @return array<mixed>
     */
    public static function sanitize(array $data): array
    {
        $clean = [];

        foreach ($data as $key => $value) {
            if (is_string($key) && preg_match(self::SENSITIVE_PATTERN, $key)) {
                $clean[$key] = $value instanceof UploadedFile ? '[archivo omitido]' : self::MASK;

                continue;
            }

            $clean[$key] = match (true) {
                $value instanceof UploadedFile => '[archivo: '.$value->getClientOriginalExtension().', '.$value->getSize().' bytes]',
                is_array($value) => self::sanitize($value),
                default => $value,
            };
        }

        return $clean;
    }

    /**
     * Sanea un cuerpo de respuesta (JSON o texto) y lo trunca.
     */
    public static function sanitizeBody(?string $body, int $limit): ?string
    {
        if ($body === null || $body === '') {
            return null;
        }

        $decoded = json_decode($body, true);

        if (is_array($decoded)) {
            $body = (string) json_encode(self::sanitize($decoded), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } elseif (! mb_check_encoding($body, 'UTF-8')) {
            return '[contenido binario omitido]';
        }

        return mb_strlen($body) > $limit ? mb_substr($body, 0, $limit).'…[truncado]' : $body;
    }
}
