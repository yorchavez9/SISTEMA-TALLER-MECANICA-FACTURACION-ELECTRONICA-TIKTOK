export type User = {
    id: number;
    first_name: string;
    last_name: string;
    name: string;
    email: string;
    theme: 'light' | 'dark' | 'system';
    avatar?: string;
    two_factor_enabled?: boolean;
    created_at: string | null;
};

export type Auth = {
    user: User | null;
    roles: string[];
    is_super_admin: boolean;
    permissions: string[];
};

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
