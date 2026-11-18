import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Option } from '@/types';

type Props = {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    className?: string;
};

/**
 * Select de shadcn/ui con una lista de opciones {value, label}.
 */
export function SelectInput({
    id,
    value,
    onChange,
    options,
    placeholder = 'Seleccione…',
    disabled,
    invalid,
    className,
}: Props) {
    return (
        <Select
            value={value || undefined}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                aria-invalid={invalid || undefined}
                className={cn('h-10 w-full text-[0.9375rem]', className)}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-[0.9375rem]"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
