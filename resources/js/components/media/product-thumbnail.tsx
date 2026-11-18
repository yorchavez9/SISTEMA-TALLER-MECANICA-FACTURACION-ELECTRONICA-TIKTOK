import { Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    src: string | null | undefined;
    alt: string;
    className?: string;
    iconClassName?: string;
};

/**
 * Imagen de producto cuadrada; si no hay imagen (o falla al cargar) muestra
 * un placeholder neutro.
 */
export function ProductThumbnail({
    src,
    alt,
    className,
    iconClassName,
}: Props) {
    const [failed, setFailed] = useState(false);
    const showImage = !!src && !failed;

    return (
        <div
            className={cn(
                'flex aspect-square size-10 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground',
                className,
            )}
        >
            {showImage ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="size-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <Package
                    className={cn('size-5', iconClassName)}
                    aria-label="Sin imagen"
                />
            )}
        </div>
    );
}
