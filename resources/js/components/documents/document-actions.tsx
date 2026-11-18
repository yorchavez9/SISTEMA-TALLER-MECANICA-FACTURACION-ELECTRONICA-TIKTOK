import {
    FileArchive,
    FileCode,
    FileText,
    FileX,
    ReceiptText,
    RefreshCw,
    RotateCcw,
    SearchCheck,
    Send,
    Trash2,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { file } from '@/routes/documents';
import type { DocumentRow } from './types';

export type DocumentActionKind =
    | 'refresh'
    | 'verify'
    | 'retry'
    | 'resend'
    | 'discard';

type Props = {
    document: DocumentRow;
    /** El usuario puede operar comprobantes (permiso documents.issue). */
    canOperate: boolean;
    /** Mostrar "Anular con nota de crédito". */
    canCreditNote: boolean;
    /** Clave de la acción en curso ("refresh:12"), o null. */
    busy: string | null;
    onAction: (kind: DocumentActionKind, document: DocumentRow) => void;
    onCreditNote: (document: DocumentRow) => void;
};

export function busyKey(kind: DocumentActionKind, id: number): string {
    return `${kind}:${id}`;
}

const BUTTON_CLASS = 'h-10';

function ActionButton({
    icon: Icon,
    label,
    loading,
    disabled,
    variant = 'outline',
    onClick,
}: {
    icon: ComponentType;
    label: ReactNode;
    loading: boolean;
    disabled: boolean;
    variant?: 'outline' | 'default' | 'secondary';
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant={variant}
            className={BUTTON_CLASS}
            disabled={disabled}
            onClick={onClick}
        >
            {loading ? <Spinner /> : <Icon />}
            {label}
        </Button>
    );
}

function DownloadLink({
    href,
    icon: Icon,
    label,
    newTab,
}: {
    href: string;
    icon: ComponentType;
    label: string;
    newTab?: boolean;
}) {
    return (
        <Button asChild variant="ghost" className={BUTTON_CLASS}>
            <a
                href={href}
                {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}
            >
                <Icon />
                {label}
            </a>
        </Button>
    );
}

/**
 * Descargas y acciones disponibles para un comprobante según su estado.
 */
export function DocumentActions({
    document,
    canOperate,
    canCreditNote,
    busy,
    onAction,
    onCreditNote,
}: Props) {
    const { id, status } = document;
    const anyBusy = busy !== null;
    const isBusy = (kind: DocumentActionKind) => busy === busyKey(kind, id);

    const operations: ReactNode[] = [];

    if (canOperate) {
        if (status === 'unknown') {
            operations.push(
                <ActionButton
                    key="verify"
                    icon={SearchCheck}
                    label="Verificar en la API"
                    variant="default"
                    loading={isBusy('verify')}
                    disabled={anyBusy}
                    onClick={() => onAction('verify', document)}
                />,
            );
        }

        if (status === 'pending' || status === 'sent') {
            operations.push(
                <ActionButton
                    key="refresh"
                    icon={RefreshCw}
                    label="Actualizar estado"
                    loading={isBusy('refresh')}
                    disabled={anyBusy}
                    onClick={() => onAction('refresh', document)}
                />,
            );
        }

        if (status === 'pending' || status === 'rejected') {
            operations.push(
                <ActionButton
                    key="resend"
                    icon={Send}
                    label="Reenviar a SUNAT"
                    loading={isBusy('resend')}
                    disabled={anyBusy}
                    onClick={() => onAction('resend', document)}
                />,
            );
        }

        if (status === 'failed') {
            operations.push(
                <ActionButton
                    key="retry"
                    icon={RotateCcw}
                    label="Reintentar envío"
                    variant="default"
                    loading={isBusy('retry')}
                    disabled={anyBusy}
                    onClick={() => onAction('retry', document)}
                />,
                <Button
                    key="discard"
                    type="button"
                    variant="outline"
                    className={`${BUTTON_CLASS} text-destructive-foreground`}
                    disabled={anyBusy}
                    onClick={() => onAction('discard', document)}
                >
                    {isBusy('discard') ? <Spinner /> : <Trash2 />}
                    Descartar
                </Button>,
            );
        }

        if (canCreditNote) {
            operations.push(
                <Button
                    key="credit-note"
                    type="button"
                    variant="outline"
                    className={`${BUTTON_CLASS} text-destructive-foreground`}
                    disabled={anyBusy}
                    onClick={() => onCreditNote(document)}
                >
                    <FileX />
                    Anular con nota de crédito
                </Button>,
            );
        }
    }

    const downloads: ReactNode[] = [];

    if (document.has_api_id) {
        downloads.push(
            <DownloadLink
                key="pdf"
                href={file.url(
                    { document: id, kind: 'pdf' },
                    { query: { format: 'a4' } },
                )}
                icon={FileText}
                label="PDF A4"
                newTab
            />,
            <DownloadLink
                key="ticket"
                href={file.url(
                    { document: id, kind: 'pdf' },
                    { query: { format: 'ticket-80' } },
                )}
                icon={ReceiptText}
                label="Ticket 80 mm"
                newTab
            />,
            <DownloadLink
                key="xml"
                href={file.url({ document: id, kind: 'xml' })}
                icon={FileCode}
                label="XML"
            />,
        );

        if (status === 'accepted' || status === 'rejected') {
            downloads.push(
                <DownloadLink
                    key="cdr"
                    href={file.url({ document: id, kind: 'cdr' })}
                    icon={FileArchive}
                    label="CDR"
                />,
            );
        }
    }

    if (operations.length === 0 && downloads.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-2">
            {operations.length > 0 && (
                <div className="flex flex-wrap gap-2">{operations}</div>
            )}
            {downloads.length > 0 && (
                <div className="-ml-2 flex flex-wrap gap-x-1 gap-y-1">
                    {downloads}
                </div>
            )}
        </div>
    );
}
