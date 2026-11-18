import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
            <div className="w-full max-w-md">
                <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <AppLogoIcon className="size-6" />
                    </div>
                    <span className="text-base font-semibold">{name}</span>
                </div>

                <div className="rounded-xl border bg-card p-6 sm:p-8">
                    <div className="mb-6 space-y-1.5 text-center">
                        <h1 className="text-xl font-semibold">{title}</h1>
                        {description && (
                            <p className="text-[0.9375rem] text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
