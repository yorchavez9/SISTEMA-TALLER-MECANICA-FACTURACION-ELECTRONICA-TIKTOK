<?php

namespace App\Enums;

/**
 * Estados de una orden de trabajo y sus transiciones válidas:
 *
 *   pendiente → en_diagnostico → en_proceso → finalizada → entregada
 *        └─────────┴──────────────┴──→ cancelada
 *
 * También se permite retroceder un paso mientras la OT no esté finalizada
 * (p. ej. volver a diagnóstico) y reabrir una finalizada a "en proceso"
 * mientras no se haya entregado.
 */
enum WorkOrderStatus: string
{
    case Pending = 'pending';
    case Diagnosing = 'diagnosing';
    case InProgress = 'in_progress';
    case Finished = 'finished';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pendiente',
            self::Diagnosing => 'En diagnóstico',
            self::InProgress => 'En proceso',
            self::Finished => 'Finalizada',
            self::Delivered => 'Entregada',
            self::Cancelled => 'Cancelada',
        };
    }

    /** Tono visual (StatusBadge del frontend). */
    public function tone(): string
    {
        return match ($this) {
            self::Pending => 'neutral',
            self::Diagnosing => 'warning',
            self::InProgress => 'primary',
            self::Finished, self::Delivered => 'success',
            self::Cancelled => 'danger',
        };
    }

    /**
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Diagnosing, self::InProgress, self::Cancelled],
            self::Diagnosing => [self::Pending, self::InProgress, self::Cancelled],
            self::InProgress => [self::Diagnosing, self::Finished, self::Cancelled],
            self::Finished => [self::InProgress, self::Delivered],
            self::Delivered, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** El contenido (diagnóstico, ítems) solo se edita en estos estados. */
    public function isEditable(): bool
    {
        return in_array($this, [self::Pending, self::Diagnosing, self::InProgress], true);
    }

    public function isOpen(): bool
    {
        return ! in_array($this, [self::Delivered, self::Cancelled], true);
    }

    /**
     * @return list<array{value: string, label: string, tone: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => ['value' => $s->value, 'label' => $s->label(), 'tone' => $s->tone()], self::cases());
    }
}
