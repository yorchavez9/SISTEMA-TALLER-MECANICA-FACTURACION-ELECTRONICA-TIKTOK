import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

type Props = {
    paginator: Omit<Paginated<unknown>, 'data'>;
    className?: string;
};

const numberFormat = new Intl.NumberFormat('es-PE');

/**
 * Paginación de un LengthAwarePaginator de Laravel.
 * Escritorio/tablet: resumen + números de página. Móvil: Anterior · Página x de y · Siguiente.
 */
export function DataTablePagination({ paginator, className }: Props) {
    const {
        current_page,
        last_page,
        from,
        to,
        total,
        prev_page_url,
        next_page_url,
    } = paginator;

    if (total === 0) {
        return null;
    }

    // Enlaces numéricos (Laravel incluye "Anterior"/"Siguiente" en los extremos).
    const pageLinks = paginator.links.slice(1, -1);

    return (
        <nav
            aria-label="Paginación"
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            <p className="text-sm text-muted-foreground">
                Mostrando {numberFormat.format(from ?? 0)}–
                {numberFormat.format(to ?? 0)} de {numberFormat.format(total)}
            </p>

            {last_page > 1 && (
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <PageButton url={prev_page_url} label="Anterior">
                        <ChevronLeft />
                        <span>Anterior</span>
                    </PageButton>

                    <span className="text-sm text-muted-foreground md:hidden">
                        Página {current_page} de {last_page}
                    </span>

                    <div className="hidden items-center gap-1 md:flex">
                        {pageLinks.map((link, index) =>
                            link.url === null ? (
                                <span
                                    key={`gap-${index}`}
                                    className="px-2 text-muted-foreground"
                                >
                                    …
                                </span>
                            ) : (
                                <Button
                                    key={link.label}
                                    asChild
                                    size="icon"
                                    variant={link.active ? 'default' : 'ghost'}
                                    className="size-9 text-sm"
                                >
                                    <Link
                                        href={link.url}
                                        preserveScroll
                                        preserveState
                                        aria-current={
                                            link.active ? 'page' : undefined
                                        }
                                        aria-label={`Página ${link.label}`}
                                    >
                                        {link.label}
                                    </Link>
                                </Button>
                            ),
                        )}
                    </div>

                    <PageButton url={next_page_url} label="Siguiente">
                        <span>Siguiente</span>
                        <ChevronRight />
                    </PageButton>
                </div>
            )}
        </nav>
    );
}

function PageButton({
    url,
    label,
    children,
}: {
    url: string | null;
    label: string;
    children: React.ReactNode;
}) {
    if (!url) {
        return (
            <Button
                variant="outline"
                className="h-10"
                disabled
                aria-label={label}
            >
                {children}
            </Button>
        );
    }

    return (
        <Button asChild variant="outline" className="h-10">
            <Link href={url} preserveScroll preserveState aria-label={label}>
                {children}
            </Link>
        </Button>
    );
}
