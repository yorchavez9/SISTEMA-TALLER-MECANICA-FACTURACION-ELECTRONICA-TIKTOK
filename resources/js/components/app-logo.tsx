import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <AppLogoIcon className="size-4.5" />
            </div>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate text-[0.9375rem] leading-tight font-semibold">
                    {name}
                </span>
            </div>
        </>
    );
}
