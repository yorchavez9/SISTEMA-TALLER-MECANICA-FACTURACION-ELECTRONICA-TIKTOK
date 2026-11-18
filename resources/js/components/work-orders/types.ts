import type { StatusTone } from '@/components/app/status-badge';
import type { Option } from '@/types';

export type WorkOrderStatusValue =
    | 'pending'
    | 'diagnosing'
    | 'in_progress'
    | 'finished'
    | 'delivered'
    | 'cancelled';

export type WorkOrderDetail = {
    id: number;
    code: string;
    status: WorkOrderStatusValue;
    status_label: string;
    status_tone: StatusTone;
    editable: boolean;
    customer: {
        id: number;
        name: string;
        document: string;
        phone: string | null;
    };
    vehicle: {
        id: number;
        plate: string;
        description: string;
        color: string | null;
        current_mileage: number | null;
    };
    assigned_user_id: number | null;
    assigned_to: string | null;
    created_by: string | null;
    mileage_in: number | null;
    reported_problem: string;
    diagnosis: string | null;
    observations: string | null;
    received_at: string;
    /** YYYY-MM-DD */
    promised_at: string | null;
    finished_at: string | null;
    delivered_at: string | null;
    cancelled_at: string | null;
    subtotal: string;
    igv: string;
    total: string;
};

export type WorkOrderItemType = 'service' | 'product' | 'labor';

export type WorkOrderItemRow = {
    id: number;
    type: WorkOrderItemType;
    type_label: string;
    description: string;
    unit: string;
    quantity: string;
    unit_price: string;
    subtotal: string;
    igv: string;
    total: string;
    stock_available: string | null;
    stock_warning: boolean;
};

export type TimelineEntry = {
    id: number;
    action: string;
    description: string;
    note: string | null;
    to: WorkOrderStatusValue | null;
    user: string | null;
    created_at: string;
};

export type StatusOption = {
    value: WorkOrderStatusValue;
    label: string;
    tone: StatusTone;
};

export type WorkOrderShowProps = {
    order: WorkOrderDetail;
    items: WorkOrderItemRow[];
    timeline: TimelineEntry[];
    transitions: StatusOption[];
    statuses: StatusOption[];
    mechanics: Option[];
    itemTypes: Option[];
    can: { update: boolean; cancel: boolean };
};

export type CatalogService = {
    id: number;
    name: string;
    price: string;
    unit: string;
    detail: string | null;
};

export type CatalogProduct = {
    id: number;
    name: string;
    code: string;
    price: string;
    unit: string;
    stock: string;
    thumb_url: string | null;
};

/** Fondo del punto/indicador según el tono del estado. */
export const TONE_DOT: Record<StatusTone, string> = {
    neutral: 'bg-muted-foreground',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
};
