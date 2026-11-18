import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { getJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type Props<T extends { id: number }> = {
    id?: string;
    /** URL JSON que responde { items: T[] } y acepta ?q= */
    url: string;
    value: T | null;
    onChange: (item: T | null) => void;
    /** Texto del botón cuando hay un valor seleccionado. */
    getLabel: (item: T) => string;
    /** Contenido de cada opción de la lista. */
    renderItem: (item: T) => ReactNode;
    placeholder?: string;
    searchPlaceholder?: string;
    invalid?: boolean;
    disabled?: boolean;
};

/**
 * Selector con búsqueda en el servidor (servicios, repuestos, etc.).
 */
export function AsyncCombobox<T extends { id: number }>({
    id,
    url,
    value,
    onChange,
    getLabel,
    renderItem,
    placeholder = 'Buscar…',
    searchPlaceholder = 'Escriba para buscar',
    invalid,
    disabled,
}: Props<T>) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);

    const load = (term: string) => {
        setLoading(true);
        getJson<{ items: T[] }>(url, { q: term })
            .then((data) => setItems(data.items))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    };

    const debouncedLoad = useDebouncedCallback(load, 300);

    useEffect(() => {
        if (open) {
            load('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    disabled={disabled}
                    className="h-10 w-full justify-between px-3 text-[0.9375rem] font-normal"
                >
                    <span
                        className={cn(
                            'truncate',
                            !value && 'text-muted-foreground',
                        )}
                    >
                        {value ? getLabel(value) : placeholder}
                    </span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-(--radix-popover-trigger-width) min-w-72 p-0"
                align="start"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        onValueChange={debouncedLoad}
                        className="text-[0.9375rem]"
                    />
                    <CommandList>
                        <CommandEmpty>
                            {loading ? 'Buscando…' : 'Sin resultados.'}
                        </CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={String(item.id)}
                                    onSelect={() => {
                                        onChange(item);
                                        setOpen(false);
                                    }}
                                    className="text-[0.9375rem]"
                                >
                                    <Check
                                        className={cn(
                                            'size-4 shrink-0',
                                            value?.id === item.id
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                    <div className="min-w-0 flex-1">
                                        {renderItem(item)}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
