import type { LucideIcon } from 'lucide-react';
import {
    CircleCheck,
    ChevronDown,
    PackageCheck,
    Play,
    Stethoscope,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusDialog } from './status-dialog';
import type {
    StatusOption,
    WorkOrderDetail,
    WorkOrderStatusValue,
} from './types';

/** Paso natural siguiente desde cada estado. */
const NEXT_STEP: Partial<
    Record<
        WorkOrderStatusValue,
        { to: WorkOrderStatusValue; label: string; icon: LucideIcon }
    >
> = {
    pending: {
        to: 'diagnosing',
        label: 'Iniciar diagnóstico',
        icon: Stethoscope,
    },
    diagnosing: { to: 'in_progress', label: 'Iniciar trabajo', icon: Play },
    in_progress: { to: 'finished', label: 'Finalizar', icon: CircleCheck },
    finished: {
        to: 'delivered',
        label: 'Marcar como entregada',
        icon: PackageCheck,
    },
};

/** Texto de las demás transiciones en el menú "Más". */
const MENU_LABELS: Record<WorkOrderStatusValue, string> = {
    pending: 'Volver a pendiente',
    diagnosing: 'Pasar a diagnóstico',
    in_progress: 'Pasar a en proceso',
    finished: 'Finalizar',
    delivered: 'Marcar como entregada',
    cancelled: 'Cancelar orden',
};

type Props = {
    order: WorkOrderDetail;
    transitions: StatusOption[];
};

/**
 * Botón principal con el siguiente paso del flujo y menú "Más" con el resto
 * de transiciones permitidas. Cada una abre un diálogo de confirmación.
 */
export function StatusActions({ order, transitions }: Props) {
    const [target, setTarget] = useState<StatusOption | null>(null);

    const next = NEXT_STEP[order.status];
    const primary = next
        ? transitions.find((t) => t.value === next.to)
        : undefined;
    const others = transitions.filter((t) => t !== primary);
    const regular = others.filter((t) => t.value !== 'cancelled');
    const cancel = others.find((t) => t.value === 'cancelled');

    if (transitions.length === 0) {
        return null;
    }

    const PrimaryIcon = next?.icon;

    return (
        <>
            {primary && next && (
                <Button
                    className="order-first h-10 w-full sm:order-last sm:w-auto"
                    onClick={() => setTarget(primary)}
                >
                    {PrimaryIcon && <PrimaryIcon />}
                    {next.label}
                </Button>
            )}

            {others.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10">
                            Más
                            <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                        {regular.map((t) => (
                            <DropdownMenuItem
                                key={t.value}
                                className="text-[0.9375rem]"
                                onSelect={() => setTarget(t)}
                            >
                                {MENU_LABELS[t.value] ?? t.label}
                            </DropdownMenuItem>
                        ))}
                        {cancel && regular.length > 0 && (
                            <DropdownMenuSeparator />
                        )}
                        {cancel && (
                            <DropdownMenuItem
                                variant="destructive"
                                className="text-[0.9375rem]"
                                onSelect={() => setTarget(cancel)}
                            >
                                <XCircle className="size-4" />
                                {MENU_LABELS.cancelled}
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <StatusDialog
                order={order}
                target={target}
                onClose={() => setTarget(null)}
            />
        </>
    );
}
