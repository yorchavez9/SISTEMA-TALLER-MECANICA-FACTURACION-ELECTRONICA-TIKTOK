import { router, usePage } from '@inertiajs/react';
import { CircleAlert, FileText, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { discard, refresh, resend, retry, verify } from '@/routes/documents';
import { CreditNoteDialog } from './credit-note-dialog';
import { busyKey, DocumentActions } from './document-actions';
import type { DocumentActionKind } from './document-actions';
import { DocumentStatusBadge } from './document-status-badge';
import { IssueDocumentDialog } from './issue-document-dialog';
import { formatIssueDate, isActiveDocument } from './types';
import type {
    DocumentPermissions,
    DocumentRow,
    DocumentSale,
    EmissionOptions,
    SaleDocument,
} from './types';

type Props = {
    sale: DocumentSale;
    documents: SaleDocument[];
    emission: EmissionOptions;
    can: DocumentPermissions;
};

const WARNING_ALERT = 'border-warning/40 bg-warning/10 text-warning-foreground';

const POST_ROUTES = { refresh, verify, retry, resend } as const;

function DocumentSummary({
    document,
    nested,
}: {
    document: DocumentRow;
    nested?: boolean;
}) {
    return (
        <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p
                    className={cn(
                        'min-w-0 break-words',
                        nested ? 'text-[0.9375rem]' : 'text-base',
                    )}
                >
                    {document.document_type_label}{' '}
                    <span className="font-semibold tabular-nums">
                        {document.number}
                    </span>
                </p>
                <DocumentStatusBadge
                    status={document.status}
                    label={document.status_label}
                    tone={document.status_tone}
                />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="tabular-nums">
                    {formatIssueDate(document.issue_date)}
                </span>
                <span aria-hidden>·</span>
                <span className="font-medium text-foreground tabular-nums">
                    {formatMoney(document.total)}
                </span>
                {document.environment === 'beta' && (
                    <StatusBadge tone="neutral">Beta</StatusBadge>
                )}
            </p>
            {document.reason_description && (
                <p className="text-sm break-words text-muted-foreground">
                    Motivo: {document.reason_description}
                </p>
            )}
            {document.detraction && (
                <p className="text-sm text-muted-foreground tabular-nums">
                    Detracción {document.detraction.code} ·{' '}
                    {Number(document.detraction.rate)} % ·{' '}
                    {formatMoney(document.detraction.amount)}
                </p>
            )}
            {document.sunat_message && (
                <p className="text-sm break-words text-muted-foreground">
                    {document.sunat_code && (
                        <span className="tabular-nums">
                            [{document.sunat_code}]{' '}
                        </span>
                    )}
                    {document.sunat_message}
                </p>
            )}
            {document.last_error && (
                <p className="text-sm break-words text-destructive-foreground">
                    {document.last_error}
                </p>
            )}
        </div>
    );
}

function UnknownWarning() {
    return (
        <Alert className={WARNING_ALERT}>
            <TriangleAlert />
            <AlertDescription className="text-sm text-warning-foreground">
                No se recibió confirmación de la API. NO vuelva a emitir:
                verifique primero.
            </AlertDescription>
        </Alert>
    );
}

/**
 * Panel "Comprobante electrónico" del detalle de venta: emisión, estado SUNAT,
 * descargas y acciones de recuperación (verificar, reintentar, reenviar...).
 */
export function DocumentPanel({ sale, documents, emission, can }: Props) {
    const { errors } = usePage().props as {
        errors: Record<string, string | undefined>;
    };
    const [busy, setBusy] = useState<string | null>(null);
    const [issueOpen, setIssueOpen] = useState(false);
    const [discardTarget, setDiscardTarget] = useState<DocumentRow | null>(
        null,
    );
    const [creditTarget, setCreditTarget] = useState<DocumentRow | null>(null);
    const [creditOpen, setCreditOpen] = useState(false);

    const canEmit = emission.ready && emission.available && can.issue;
    const pageError = errors.document ?? errors.credit_note ?? errors.api;
    // Mientras un diálogo está abierto, el error se muestra dentro de él.
    const showPageError =
        !!pageError && !issueOpen && !creditOpen && discardTarget === null;

    const runAction = (kind: DocumentActionKind, document: DocumentRow) => {
        if (kind === 'discard') {
            setDiscardTarget(document);

            return;
        }

        const key = busyKey(kind, document.id);
        setBusy(key);
        router.post(
            POST_ROUTES[kind].url(document.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setBusy(null),
            },
        );
    };

    const confirmDiscard = () => {
        if (!discardTarget) {
            return;
        }

        setBusy(busyKey('discard', discardTarget.id));
        router.delete(discard.url(discardTarget.id), {
            preserveScroll: true,
            // Si falla, el error se muestra en el panel al cerrar el diálogo.
            onFinish: () => {
                setBusy(null);
                setDiscardTarget(null);
            },
        });
    };

    const openCreditNote = (document: DocumentRow) => {
        setCreditTarget(document);
        setCreditOpen(true);
    };

    const allowsCreditNote = (document: SaleDocument) =>
        can.creditNote &&
        !emission.nrus &&
        document.status === 'accepted' &&
        (document.document_type === '01' || document.document_type === '03') &&
        !document.notes.some(isActiveDocument);

    return (
        <>
            <SectionCard title="Comprobante electrónico">
                <div className="grid min-w-0 gap-4">
                    {!emission.ready && (
                        <Alert className={WARNING_ALERT}>
                            <TriangleAlert />
                            <AlertDescription className="text-sm text-warning-foreground">
                                El taller aún no está registrado en la API de
                                facturación. Pida al super administrador que
                                complete el registro.
                            </AlertDescription>
                        </Alert>
                    )}

                    {showPageError && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertTitle className="text-[0.9375rem]">
                                No se pudo completar la operación
                            </AlertTitle>
                            <AlertDescription className="text-sm break-words">
                                {pageError}
                            </AlertDescription>
                        </Alert>
                    )}

                    {documents.length === 0 && (
                        <p className="text-[0.9375rem] text-muted-foreground">
                            {sale.status === 'voided'
                                ? 'La venta está anulada; no se emitió comprobante.'
                                : 'Esta venta aún no tiene comprobante electrónico.'}
                        </p>
                    )}

                    {canEmit && (
                        <div className="grid gap-2">
                            <Button
                                className="h-10 w-full sm:w-auto sm:justify-self-start"
                                onClick={() => setIssueOpen(true)}
                                disabled={busy !== null}
                            >
                                <FileText />
                                Emitir comprobante
                            </Button>
                            {emission.environment === 'beta' && (
                                <p className="text-sm text-warning-foreground">
                                    Entorno de pruebas (beta): sin validez
                                    tributaria.
                                </p>
                            )}
                        </div>
                    )}

                    {documents.length > 0 && (
                        <ul className="grid gap-3">
                            {documents.map((document) => (
                                <li
                                    key={document.id}
                                    className="grid min-w-0 gap-3 rounded-lg border p-4"
                                >
                                    <DocumentSummary document={document} />

                                    {document.status === 'unknown' && (
                                        <UnknownWarning />
                                    )}

                                    <DocumentActions
                                        document={document}
                                        canOperate={can.issue}
                                        canCreditNote={allowsCreditNote(
                                            document,
                                        )}
                                        busy={busy}
                                        onAction={runAction}
                                        onCreditNote={openCreditNote}
                                    />

                                    {document.notes.length > 0 && (
                                        <ul className="grid gap-3 border-l-2 pl-3">
                                            {document.notes.map((note) => (
                                                <li
                                                    key={note.id}
                                                    className="grid min-w-0 gap-3"
                                                >
                                                    <DocumentSummary
                                                        document={note}
                                                        nested
                                                    />
                                                    {note.status ===
                                                        'unknown' && (
                                                        <UnknownWarning />
                                                    )}
                                                    <DocumentActions
                                                        document={note}
                                                        canOperate={can.issue}
                                                        canCreditNote={false}
                                                        busy={busy}
                                                        onAction={runAction}
                                                        onCreditNote={
                                                            openCreditNote
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </SectionCard>

            {canEmit && (
                <IssueDocumentDialog
                    sale={sale}
                    emission={emission}
                    open={issueOpen}
                    onOpenChange={setIssueOpen}
                />
            )}

            <CreditNoteDialog
                document={creditTarget}
                open={creditOpen}
                onOpenChange={setCreditOpen}
            />

            <ConfirmDialog
                open={discardTarget !== null}
                onOpenChange={(open) => !open && setDiscardTarget(null)}
                title={`Descartar ${discardTarget?.document_type_label ?? 'comprobante'} ${discardTarget?.number ?? ''}`}
                description="Este intento no se registró en la API de facturación. Al descartarlo, la venta queda libre para emitir el comprobante nuevamente (incluso de otro tipo, por ejemplo boleta en lugar de factura)."
                confirmLabel="Descartar intento"
                variant="destructive"
                processing={
                    discardTarget !== null &&
                    busy === busyKey('discard', discardTarget.id)
                }
                onConfirm={confirmDiscard}
            />
        </>
    );
}
