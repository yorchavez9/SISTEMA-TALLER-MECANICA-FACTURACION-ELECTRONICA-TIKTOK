import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ProductThumbnail } from '@/components/media/product-thumbnail';
import { Button } from '@/components/ui/button';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

type Props = {
    /** URL de la imagen actual guardada (null si no tiene). */
    currentUrl: string | null;
    /** Archivo nuevo elegido (null si no hay). */
    file: File | null;
    /** true si el usuario pidió quitar la imagen actual. */
    removed: boolean;
    onChange: (value: { file: File | null; removed: boolean }) => void;
    error?: string;
    alt: string;
};

/**
 * Carga opcional de imagen con vista previa, reemplazo y eliminación.
 * La validación real (tipo, tamaño, contenido) está en el backend; aquí solo
 * se avisa antes de enviar para una mejor experiencia.
 */
export function ImageUpload({
    currentUrl,
    file,
    removed,
    onChange,
    error,
    alt,
}: Props) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setPreview(null);

            return;
        }

        const url = URL.createObjectURL(file);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    const shownUrl = preview ?? (removed ? null : currentUrl);

    const pick = (selected: File | undefined) => {
        if (!selected) {
            return;
        }

        if (!ACCEPTED_TYPES.includes(selected.type)) {
            setClientError('Formato no permitido. Use JPG, PNG o WEBP.');

            return;
        }

        if (selected.size > MAX_BYTES) {
            setClientError('La imagen no debe pesar más de 2 MB.');

            return;
        }

        setClientError(null);
        onChange({ file: selected, removed: false });
    };

    const clear = () => {
        if (inputRef.current) {
            inputRef.current.value = '';
        }

        setClientError(null);
        // Si había un archivo nuevo, se descarta; si no, se marca la actual para quitarla.
        onChange({ file: null, removed: file ? removed : currentUrl !== null });
    };

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <ProductThumbnail
                src={shownUrl}
                alt={alt}
                className="size-32 shrink-0 sm:size-36"
                iconClassName="size-8"
            />

            <div className="flex min-w-0 flex-col gap-3">
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => pick(e.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => inputRef.current?.click()}
                    >
                        {shownUrl ? <RefreshCw /> : <ImagePlus />}
                        {shownUrl ? 'Cambiar imagen' : 'Subir imagen'}
                    </Button>
                    {shownUrl && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="text-destructive-foreground"
                            onClick={clear}
                        >
                            <Trash2 />
                            Quitar
                        </Button>
                    )}
                </div>
                <p className="text-sm text-muted-foreground">
                    Opcional. JPG, PNG o WEBP de hasta 2 MB. Se optimiza
                    automáticamente.
                </p>
                {removed && !file && currentUrl && (
                    <p className="text-sm text-warning-foreground">
                        La imagen actual se quitará al guardar.
                    </p>
                )}
                {(clientError || error) && (
                    <p className="text-sm text-destructive-foreground">
                        {clientError ?? error}
                    </p>
                )}
            </div>
        </div>
    );
}
