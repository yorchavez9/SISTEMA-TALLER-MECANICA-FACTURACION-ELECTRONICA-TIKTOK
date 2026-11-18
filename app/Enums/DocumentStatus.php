<?php

namespace App\Enums;

/**
 * Estado local de un comprobante electrónico.
 *
 *   sending ─POST ok─► pending / sent ─GET─► accepted ──NC aceptada──► voided
 *      │                    └─GET─► rejected (corregir / reenviar)
 *      ├─ 4xx (la API NO lo creó) ─► failed   (corregir datos y reintentar)
 *      └─ timeout / sin respuesta ─► unknown  (VERIFICAR antes de reintentar)
 */
enum DocumentStatus: string
{
    case Sending = 'sending';
    case Failed = 'failed';
    case Unknown = 'unknown';
    case Pending = 'pending';
    case Sent = 'sent';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Voided = 'voided';

    public function label(): string
    {
        return match ($this) {
            self::Sending => 'Enviando',
            self::Failed => 'No registrado (error)',
            self::Unknown => 'Sin confirmar',
            self::Pending => 'Pendiente de envío',
            self::Sent => 'Enviado a SUNAT',
            self::Accepted => 'Aceptado por SUNAT',
            self::Rejected => 'Rechazado por SUNAT',
            self::Voided => 'Anulado',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Accepted => 'success',
            self::Pending, self::Sent, self::Sending => 'primary',
            self::Unknown => 'warning',
            self::Failed, self::Rejected => 'danger',
            self::Voided => 'neutral',
        };
    }

    /**
     * Mapea el estado literal de la API (pendiente | enviado | aceptado | rechazado).
     */
    public static function fromApi(?string $apiStatus): ?self
    {
        return match (mb_strtolower(trim((string) $apiStatus))) {
            'pendiente', 'pending', 'registrado' => self::Pending,
            'enviado', 'sent', 'en_proceso', 'procesando' => self::Sent,
            'aceptado', 'accepted', 'aceptada' => self::Accepted,
            'rechazado', 'rejected', 'rechazada' => self::Rejected,
            'anulado', 'anulada', 'baja' => self::Voided,
            default => null,
        };
    }

    /** Cuenta como comprobante vigente de la venta (bloquea emitir otro). */
    public function isActive(): bool
    {
        return ! in_array($this, [self::Failed, self::Voided], true);
    }

    /** Debe consultarse su estado en la API (botón y tarea programada). */
    public function needsStatusCheck(): bool
    {
        return in_array($this, [self::Pending, self::Sent], true);
    }

    /**
     * @return list<array{value: string, label: string, tone: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => ['value' => $s->value, 'label' => $s->label(), 'tone' => $s->tone()], self::cases());
    }
}
