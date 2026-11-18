import { History } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TONE_DOT } from './types';
import type { StatusOption, TimelineEntry } from './types';

type Props = {
    entries: TimelineEntry[];
    statuses: StatusOption[];
};

/** Historial de la OT (más reciente primero). */
export function WorkOrderTimeline({ entries, statuses }: Props) {
    if (entries.length === 0) {
        return (
            <EmptyState
                icon={History}
                title="Sin movimientos"
                description="Aquí aparecerán los cambios de estado y de ítems."
                className="py-6"
            />
        );
    }

    const toneOf = (value: TimelineEntry['to']) =>
        value ? statuses.find((s) => s.value === value)?.tone : undefined;

    return (
        <ol className="relative grid gap-5">
            {entries.map((entry, index) => {
                const tone = toneOf(entry.to);

                return (
                    <li key={entry.id} className="relative flex gap-3">
                        {index < entries.length - 1 && (
                            <span
                                aria-hidden
                                className="absolute top-4 bottom-[-1.25rem] left-[0.3125rem] w-px bg-border"
                            />
                        )}
                        <span
                            aria-hidden
                            className={cn(
                                'relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card',
                                tone ? TONE_DOT[tone] : 'bg-border',
                            )}
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="text-[0.9375rem] break-words">
                                {entry.description}
                            </p>
                            {entry.note && (
                                <p className="rounded-md bg-muted px-3 py-2 text-sm break-words whitespace-pre-line text-muted-foreground">
                                    {entry.note}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                                {entry.user ?? 'Sistema'} ·{' '}
                                <time
                                    dateTime={entry.created_at}
                                    title={formatDateTime(entry.created_at)}
                                >
                                    {formatRelative(entry.created_at)}
                                </time>
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
