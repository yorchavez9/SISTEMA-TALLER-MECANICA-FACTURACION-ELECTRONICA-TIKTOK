/** Taller en el que se opera (prop compartida "company"). */
export type CompanyContext = {
    id: number;
    ruc: string;
    name: string;
    billing_status: BillingStatus | null;
    environment: 'beta' | 'production' | null;
    /** true cuando el super admin entró a un taller. */
    acting_as_admin: boolean;
};

export type BillingStatus = 'not_configured' | 'provisioning_error' | 'ready';

export type Option = { value: string; label: string };

export type ConnectionCheck = { name: string; ok: boolean; detail: string };

export type ApiPlan = {
    slug: string;
    nombre: string;
    precio_mensual: string | null;
    precio_anual: string | null;
    limites: Record<string, number>;
};
