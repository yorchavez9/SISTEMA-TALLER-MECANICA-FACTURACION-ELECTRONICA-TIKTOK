import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    description?: ReactNode;
    icon?: LucideIcon;
    action?: ReactNode;
    className?: string;
};

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
    className,
}: Props) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center',
                className,
            )}
        >
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-5" />
            </div>
            <div className="space-y-1">
                <p className="text-base font-medium">{title}</p>
                {description && (
                    <p className="max-w-sm text-[0.9375rem] text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}
