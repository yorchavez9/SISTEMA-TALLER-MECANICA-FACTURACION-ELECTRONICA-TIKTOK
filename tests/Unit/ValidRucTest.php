<?php

namespace Tests\Unit;

use App\Rules\ValidRuc;
use App\Services\SunatApi\LogSanitizer;
use PHPUnit\Framework\TestCase;

class ValidRucTest extends TestCase
{
    public function test_valid_rucs_pass(): void
    {
        // RUC públicos conocidos (SUNAT, persona natural de ejemplo).
        $this->assertTrue(ValidRuc::isValid('20131312955'));
        $this->assertTrue(ValidRuc::isValid('20100070970'));
    }

    public function test_invalid_rucs_fail(): void
    {
        $this->assertFalse(ValidRuc::isValid('20131312954'));  // dígito verificador incorrecto
        $this->assertFalse(ValidRuc::isValid('30131312955'));  // prefijo inválido
        $this->assertFalse(ValidRuc::isValid('2013131295'));   // 10 dígitos
        $this->assertFalse(ValidRuc::isValid('2013131295A'));
    }

    public function test_sanitizer_masks_sensitive_keys_recursively(): void
    {
        $clean = LogSanitizer::sanitize([
            'ruc' => '20131312955',
            'sol_user' => 'MODDATOS',
            'sol_pass' => 'secreta',
            'contrasena_certificado' => '123456',
            'client_secret' => 'abc',
            'datos' => ['api_key' => 'pk', 'api_secret' => 'sk', 'nombre' => 'Taller'],
        ]);

        $this->assertSame('20131312955', $clean['ruc']);
        $this->assertSame('***', $clean['sol_user']);
        $this->assertSame('***', $clean['sol_pass']);
        $this->assertSame('***', $clean['contrasena_certificado']);
        $this->assertSame('***', $clean['client_secret']);
        $this->assertSame('***', $clean['datos']['api_key']);
        $this->assertSame('***', $clean['datos']['api_secret']);
        $this->assertSame('Taller', $clean['datos']['nombre']);
    }

    public function test_sanitizer_body_masks_json_and_truncates(): void
    {
        $body = json_encode(['estado' => 'exito', 'datos' => ['api_secret' => 'sk_live_x']]);
        $this->assertStringNotContainsString('sk_live_x', (string) LogSanitizer::sanitizeBody($body, 1000));

        $long = str_repeat('a', 50);
        $this->assertStringEndsWith('…[truncado]', (string) LogSanitizer::sanitizeBody($long, 10));
    }
}
