import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useBreakpoints } from '@/hooks/use-media-query';

type Props = {
    search: string;
    onSearch: (value: string) => void;
    searchPlaceholder?: string;
    /** Filtros adicionales: en línea en escritorio, dentro de un panel en móvil. */
    filters?: ReactNode;
    activeFilters?: number;
    /** Acciones extra a la derecha (exportar, etc.). */
    actions?: ReactNode;
};

export function DataTableToolbar({
    search,
    onSearch,
    searchPlaceholder = 'Buscar…',
    filters,
    activeFilters = 0,
    actions,
}: Props) {
    const { isMobile } = useBreakpoints();
    const [value, setValue] = useState(search);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const debouncedSearch = useDebouncedCallback(onSearch, 350);

    const handleChange = (next: string) => {
        setValue(next);
        debouncedSearch(next);
    };

    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:items-center">
                <div className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={value}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="h-10 pr-10 pl-9 text-[0.9375rem]"
                    />
                    {value && (
                        <button
                            type="button"
                            onClick={() => {
                                setValue('');
                                onSearch('');
                            }}
                            className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                            aria-label="Limpiar búsqueda"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                {filters && !isMobile && (
                    <div className="flex flex-wrap items-center gap-2">
                        {filters}
                    </div>
                )}

                {filters && isMobile && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full"
                            onClick={() => setFiltersOpen(true)}
                        >
                            <SlidersHorizontal />
                            Filtros
                            {activeFilters > 0 && (
                                <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                                    {activeFilters}
                                </span>
                            )}
                        </Button>
                        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                            <SheetContent
                                side="bottom"
                                className="max-h-[85svh] overflow-y-auto"
                            >
                                <SheetHeader>
                                    <SheetTitle>Filtros</SheetTitle>
                                    <SheetDescription>
                                        Ajuste los filtros del listado.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="grid gap-4 px-4 pb-6">
                                    {filters}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </>
                )}
            </div>

            {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
    );
}
