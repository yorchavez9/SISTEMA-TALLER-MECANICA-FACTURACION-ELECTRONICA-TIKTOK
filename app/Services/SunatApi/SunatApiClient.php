<?php

namespace App\Services\SunatApi;

use App\Models\ApiOperationLog;
use App\Models\Company;
use App\Services\SunatApi\Exceptions\ApiAuthException;
use App\Services\SunatApi\Exceptions\ApiConnectionException;
use App\Services\SunatApi\Exceptions\ApiNotConfiguredException;
use App\Services\SunatApi\Exceptions\ApiNotFoundException;
use App\Services\SunatApi\Exceptions\ApiServerException;
use App\Services\SunatApi\Exceptions\ApiValidationException;
use App\Services\SunatApi\Exceptions\SunatApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Única clase que habla HTTP con la API SUNAT PRO.
 *
 * - Agrega X-Api-Key / X-Api-Secret de la empresa (nunca salen del backend).
 * - Interpreta el sobre {estado, mensaje, datos, errores} y lanza excepciones tipadas.
 * - Registra cada llamada en api_operation_logs sin datos sensibles.
 * - No reintenta solicitudes: un reintento ciego de un POST podría duplicar
 *   comprobantes (ver docs, §8.4).
 */
class SunatApiClient
{
    private function __construct(
        private readonly ?string $apiKey,
        private readonly ?string $apiSecret,
        private readonly ?Company $company,
    ) {}

    /**
     * Cliente autenticado con las credenciales del taller.
     *
     * @throws ApiNotConfiguredException
     */
    public static function forCompany(Company $company): self
    {
        $settings = $company->billingSettings;

        if ($settings === null || ! $settings->hasCredentials()) {
            throw new ApiNotConfiguredException('El taller todavía no está registrado en la API de facturación.', errorType: 'not_configured');
        }

        return new self($settings->api_key, $settings->api_secret, $company);
    }

    /**
     * Cliente sin credenciales (endpoints públicos: /registro, /planes, /credenciales/recuperar).
     */
    public static function anonymous(?Company $company = null): self
    {
        return new self(null, null, $company);
    }

    /**
     * Cliente para catálogos y búsqueda RUC/DNI: usa las credenciales del taller
     * si existen; si no, la credencial de consulta del sistema (.env). Devuelve
     * null si no hay ninguna disponible.
     */
    public static function forLookups(?Company $company): ?self
    {
        $settings = $company?->billingSettings;

        if ($settings !== null && $settings->hasCredentials()) {
            return new self($settings->api_key, $settings->api_secret, $company);
        }

        $key = config('sunat_api.lookup_key');
        $secret = config('sunat_api.lookup_secret');

        return filled($key) && filled($secret) ? new self($key, $secret, $company) : null;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    public function get(string $path, array $query = [], string $operation = 'get'): ApiResponse
    {
        return $this->send('GET', $path, $operation, fn (PendingRequest $r, string $url) => $r->get($url, $query), $query);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function post(string $path, array $data = [], string $operation = 'post'): ApiResponse
    {
        return $this->send('POST', $path, $operation, fn (PendingRequest $r, string $url) => $r->asJson()->post($url, $data), $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function put(string $path, array $data = [], string $operation = 'put'): ApiResponse
    {
        return $this->send('PUT', $path, $operation, fn (PendingRequest $r, string $url) => $r->asJson()->put($url, $data), $data);
    }

    public function delete(string $path, string $operation = 'delete'): ApiResponse
    {
        return $this->send('DELETE', $path, $operation, fn (PendingRequest $r, string $url) => $r->delete($url));
    }

    /**
     * POST multipart/form-data (registro, certificado, logo).
     *
     * @param  array<string, scalar|null>  $fields
     * @param  array<string, UploadedFile>  $files
     */
    public function postMultipart(string $path, array $fields, array $files, string $operation = 'upload'): ApiResponse
    {
        $timeout = (int) config('sunat_api.upload_timeout');

        return $this->send('POST', $path, $operation, function (PendingRequest $r, string $url) use ($fields, $files, $timeout) {
            $request = $r->timeout($timeout)->asMultipart();

            foreach ($files as $name => $file) {
                $request = $request->attach(
                    $name,
                    (string) file_get_contents($file->getRealPath()),
                    $file->getClientOriginalName(),
                );
            }

            $multipart = [];
            foreach ($fields as $name => $value) {
                if ($value !== null) {
                    $multipart[] = ['name' => $name, 'contents' => is_bool($value) ? ($value ? '1' : '0') : (string) $value];
                }
            }

            return $request->post($url, $multipart);
        }, [...$fields, ...$files]);
    }

    /**
     * Healthcheck de la API (fuera de /v1, sin credenciales).
     */
    public function health(): ApiResponse
    {
        $url = config('sunat_api.root_url').'/health';

        return $this->send('GET', $url, 'health', fn (PendingRequest $r, string $u) => $r->get($u), absolute: true);
    }

    /**
     * @param  callable(PendingRequest, string): Response  $callback
     * @param  array<mixed>  $payload
     */
    private function send(string $method, string $path, string $operation, callable $callback, array $payload = [], bool $absolute = false): ApiResponse
    {
        $url = $absolute ? $path : config('sunat_api.base_url').'/'.ltrim($path, '/');
        $endpoint = $absolute ? $path : '/'.ltrim($path, '/');
        $started = hrtime(true);
        $response = null;
        $exception = null;

        try {
            $response = $callback($this->request(), $url);
            $result = $this->interpret($response);

            return $result;
        } catch (ConnectionException $e) {
            $exception = new ApiConnectionException(
                'No se obtuvo respuesta de la API de facturación (tiempo de espera agotado o sin conexión).',
                errorType: 'connection',
                previous: $e,
            );

            throw $exception;
        } catch (SunatApiException $e) {
            $exception = $e;

            throw $e;
        } finally {
            $this->log($operation, $method, $endpoint, $payload, $response, $exception, $started);
        }
    }

    private function request(): PendingRequest
    {
        $headers = ['Accept' => 'application/json'];

        if ($this->apiKey !== null && $this->apiSecret !== null) {
            $headers['X-Api-Key'] = $this->apiKey;
            $headers['X-Api-Secret'] = $this->apiSecret;
        }

        return Http::withHeaders($headers)
            ->timeout((int) config('sunat_api.timeout'))
            ->connectTimeout((int) config('sunat_api.connect_timeout'));
    }

    /**
     * Convierte la respuesta HTTP en ApiResponse o lanza la excepción que corresponde.
     */
    private function interpret(Response $response): ApiResponse
    {
        $json = $response->json();
        $body = is_array($json) ? $json : [];

        $estado = isset($body['estado']) ? (string) $body['estado'] : null;
        $mensaje = isset($body['mensaje']) ? (string) $body['mensaje'] : null;
        $errors = isset($body['errores']) && is_array($body['errores']) ? $body['errores'] : [];
        $status = $response->status();

        if ($status >= 400 || $estado === 'error') {
            $message = $mensaje ?: 'La API de facturación respondió con un error (HTTP '.$status.').';

            throw match (true) {
                $status === 422 => new ApiValidationException($message, $status, $errors, 'validation'),
                in_array($status, [401, 403], true) => new ApiAuthException($message, $status, $errors, 'auth'),
                $status === 404 => new ApiNotFoundException($message, $status, $errors, 'not_found'),
                $status >= 500 => new ApiServerException($message, $status, $errors, 'server'),
                default => new SunatApiException($message, $status, $errors, 'business'),
            };
        }

        $datos = $body['datos'] ?? null;

        return new ApiResponse(
            status: $status,
            estado: $estado,
            mensaje: $mensaje,
            datos: is_array($datos) ? $datos : null,
            meta: isset($body['meta']) && is_array($body['meta']) ? $body['meta'] : null,
            raw: $body,
        );
    }

    /**
     * @param  array<mixed>  $payload
     */
    private function log(string $operation, string $method, string $endpoint, array $payload, ?Response $response, ?SunatApiException $exception, int|float $started): void
    {
        try {
            $json = $response?->json();

            ApiOperationLog::query()->withoutGlobalScopes()->create([
                'company_id' => $this->company?->id,
                'user_id' => Auth::id(),
                'operation' => $operation,
                'http_method' => $method,
                'endpoint' => mb_substr($endpoint, 0, 255),
                'http_status' => $response?->status(),
                'api_estado' => is_array($json) && isset($json['estado']) ? mb_substr((string) $json['estado'], 0, 20) : null,
                'api_mensaje' => $exception?->userMessage() ?? (is_array($json) && isset($json['mensaje']) ? (string) $json['mensaje'] : null),
                'request_summary' => $payload === [] ? null : LogSanitizer::sanitize($payload),
                'response_body' => LogSanitizer::sanitizeBody($response?->body(), (int) config('sunat_api.log_body_limit')),
                'error_type' => $exception?->errorType,
                'duration_ms' => (int) ((hrtime(true) - $started) / 1_000_000),
            ]);
        } catch (Throwable $e) {
            // El registro nunca debe interrumpir la operación principal.
            Log::warning('No se pudo registrar la llamada a la API SUNAT.', ['operation' => $operation, 'error' => $e->getMessage()]);
        }
    }
}
