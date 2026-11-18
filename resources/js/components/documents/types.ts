import type { StatusTone } from '@/components/app/status-badge';
import type { Option } from '@/types';
import type { DocumentStatus } from './document-status-badge';

export type { DocumentStatus };

export type DocumentTypeCode = '01' | '03' | '07' | '08';

export type DocumentRow = {
    id: number;
    document_type: DocumentTypeCode;
    document_type_label: string;
    number: string;
    issue_date: string;
    customer_name: string;
    customer_document: string | null;
    total: string;
    status: DocumentStatus;
    status_label: string;
    status_tone: StatusTone;
    sunat_code: string | null;
    sunat_message: string | null;
    last_error: string | null;
    // 'beta' | 'production'
    environment: string | null;
    sale_id: number | null;
    related_document_id: number | null;
    reason_description: string | null;
    detraction: { code: string; rate: string; amount: string } | null;
    has_api_id: boolean;
    accepted_at: string | null;
    last_checked_at: string | null;
};

export type SaleDocument = DocumentRow & { notes: DocumentRow[] };

export type DetractionTypeOption = Option & { rate: string };

export type EmissionOptions = {
    available: boolean;
    ready: boolean;
    // 'beta' | 'production'
    environment: string | null;
    nrus: boolean;
    customer_has_ruc: boolean;
    customer_identified: boolean;
    series: { '01': Option[]; '03': Option[] };
    detraction: {
        eligible: boolean;
        suggested: boolean;
        reason: string | null;
        type_id: number | null;
        rate: string | null;
        threshold: string;
        account: string | null;
        payment_method: string;
    };
    detractionTypes: DetractionTypeOption[];
};

export type DocumentPermissions = {
    issue: boolean;
    creditNote: boolean;
};

/** Datos mínimos de la venta que necesita el panel. */
export type DocumentSale = {
    id: number;
    code: string;
    total: string;
    status: 'registered' | 'voided';
    customer: { name: string; document: string };
};

/** Estados que siguen "vigentes" (bloquean emitir otro comprobante). */
export const ACTIVE_STATUSES: DocumentStatus[] = [
    'sending',
    'unknown',
    'pending',
    'sent',
    'accepted',
    'rejected',
];

export function isActiveDocument(doc: Pick<DocumentRow, 'status'>): boolean {
    return ACTIVE_STATUSES.includes(doc.status);
}

/** "2026-11-18" → "18/11/2026" sin desfase de zona horaria. */
export function formatIssueDate(date: string | null | undefined): string {
    if (!date) {
        return '—';
    }

    const [y, m, d] = date.slice(0, 10).split('-');

    return y && m && d ? `${d}/${m}/${y}` : date;
}
