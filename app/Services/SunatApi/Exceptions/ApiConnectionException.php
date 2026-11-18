<?php

namespace App\Services\SunatApi\Exceptions;

/**
 * Sin respuesta de la API (timeout o conexión). No debe reintentarse un envío sin verificar antes.
 */
class ApiConnectionException extends SunatApiException {}
