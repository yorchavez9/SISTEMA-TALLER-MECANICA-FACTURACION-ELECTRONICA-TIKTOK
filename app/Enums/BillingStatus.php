<?php

namespace App\Enums;

/**
 * Estado de la configuración de facturación electrónica de un taller.
 */
enum BillingStatus: string
{
    case NotConfigured = 'not_configured';
    case ProvisioningError = 'provisioning_error';
    case Ready = 'ready';

    public function label(): string
    {
        return match ($this) {
            self::NotConfigured => 'Sin registrar en la API',
            self::ProvisioningError => 'Error de aprovisionamiento',
            self::Ready => 'Listo para facturar',
        };
    }
}
