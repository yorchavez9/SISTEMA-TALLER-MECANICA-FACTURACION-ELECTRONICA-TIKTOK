import type { Auth } from '@/types/auth';
import type { CompanyContext, ConnectionCheck } from '@/types/company';
import type { FlashToast } from '@/types/ui';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            company: CompanyContext | null;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: FlashToast;
            connectionChecks?: ConnectionCheck[];
        };
    }
}
