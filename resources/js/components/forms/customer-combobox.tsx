import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { search as customersSearch } from '@/routes/customers';

export type CustomerOption = { id: number; name: string; document: string };

type Props = {
    id?: string;
    value: CustomerOption | null;
    onChange: (customer: CustomerOption | null) => void;
    invalid?: boolean;
    disabled?: boolean;
};

/**
 * Selector de cliente con búsqueda en el servidor (nombre o documento).
 */
export function CustomerCombobox({
    id,
    value,
    onChange,
    invalid,
    disabled,
}: Props) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<CustomerOption[]>([]);
    const [loading, setLoading] = useState(false);

    const load = (term: string) => {
        setLoading(true);
        getJson<{ items: CustomerOption[] }>(customersSearch.url(), { q: term })
            .then((data) => setItems(data.items))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    };

    const debouncedLoad = useDebouncedCallback(load, 300);

    useEffect(() => {
        if (open) {
            load('');
        }
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
                        {value
                            ? `${value.name} · ${value.document}`
                            : 'Buscar cliente…'}
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
                        placeholder="Nombre o número de documento"
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
                                            'size-4',
                                            value?.id === item.id
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate">{item.name}</p>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {item.document}
                                        </p>
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
