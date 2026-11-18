<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * RUC peruano: 11 dígitos, prefijo 10/15/16/17/20 y dígito verificador
 * (módulo 11).
 */
class ValidRuc implements ValidationRule
{
    private const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    public static function isValid(string $ruc): bool
    {
        if (! preg_match('/^(10|15|16|17|20)\d{9}$/', $ruc)) {
            return false;
        }

        $sum = 0;
        foreach (self::WEIGHTS as $i => $weight) {
            $sum += (int) $ruc[$i] * $weight;
        }

        $check = 11 - ($sum % 11);
        $check = match ($check) {
            10 => 0,
            11 => 1,
            default => $check,
        };

        return $check === (int) $ruc[10];
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! self::isValid($value)) {
            $fail('El :attribute no es un RUC válido.');
        }
    }
}
