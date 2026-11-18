<?php

/*
| Integración con la API SUNAT PRO.
|
| Las credenciales (X-Api-Key / X-Api-Secret) son POR EMPRESA: las genera
| POST /registro y se guardan cifradas en company_billing_settings. Nunca se
| muestran en el navegador ni se escriben en logs.
*/

return [
    'base_url' => rtrim((string) env('SUNAT_API_BASE_URL', 'https://sunat.kodevo.es/api/v1'), '/'),

    // Rutas sin /v1 (health).
    'root_url' => rtrim((string) env('SUNAT_API_ROOT_URL', 'https://sunat.kodevo.es/api'), '/'),

    'timeout' => (int) env('SUNAT_API_TIMEOUT', 30),
    'connect_timeout' => (int) env('SUNAT_API_CONNECT_TIMEOUT', 10),

    // Subida de certificado y registro (multipart): más margen.
    'upload_timeout' => (int) env('SUNAT_API_UPLOAD_TIMEOUT', 60),

    // Entorno inicial de un taller nuevo (beta | production).
    'default_environment' => env('SUNAT_API_DEFAULT_ENV', 'beta'),

    /*
    | Credencial opcional de consulta (solo servidor): se usa para catálogos de
    | ubigeo y búsqueda RUC/DNI cuando el taller todavía no está registrado en
    | la API. Puede ser la credencial de la empresa del propietario del sistema.
    */
    'lookup_key' => env('SUNAT_API_LOOKUP_KEY'),
    'lookup_secret' => env('SUNAT_API_LOOKUP_SECRET'),

    // Tamaño máximo guardado del cuerpo de respuesta en api_operation_logs.
    'log_body_limit' => 16384,

    // Días que se conservan los registros de llamadas a la API.
    'log_retention_days' => 90,
];
