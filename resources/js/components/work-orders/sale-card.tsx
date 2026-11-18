import { Link } from '@inertiajs/react';
import { ChevronRight, Receipt } from 'lucide-react';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { formatMoney } from '@/lib/format';
import { show as saleShow } from '@/routes/sales';
import type { WorkOrderSale } from './types';

type Props = {
    sale: WorkOrderSale;
    /** Si ya se puede generar una nueva venta (la anterior fue anulada). */
    canCreateSale: boolean;
};

/** Venta vinculada a la orden (la más reciente). */
export function WorkOrderSaleCard({ sale, canCreateSale }: Props) {
    const voided = sale.status === 'voided';

    return (
        <SectionCard title="Venta">
            <div className="grid gap-3">
                <Link
                    href={saleShow(sale.id)}
                    className="flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                    <Receipt className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-medium text-link tabular-nums">
                            {sale.code}
                        </p>
                        <p
                            className={
                                voided
                                    ? 'text-sm text-muted-foreground tabular-nums line-through'
                                    : 'text-sm text-muted-foreground tabular-nums'
                            }
                        >
                            {formatMoney(sale.total)}
                        </p>
                    </div>
                    <StatusBadge tone={voided ? 'danger' : 'success'}>
                        {voided ? 'Anulada' : 'Registrada'}
                    </StatusBadge>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
                {voided ? (
                    <p className="text-sm text-muted-foreground">
                        {canCreateSale
                            ? 'La venta anterior fue anulada; puede generar una nueva venta o reabrir la orden.'
                            : 'Puede reabrir la orden o generar una nueva venta.'}
                    </p>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        El comprobante electrónico se emite desde la venta.
                    </p>
                )}
            </div>
        </SectionCard>
    );
}
