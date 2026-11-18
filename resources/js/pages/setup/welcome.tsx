import { Form, Head, usePage } from '@inertiajs/react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { store } from '@/routes/setup';

type Props = {
    passwordRules: string;
};

/** Requisitos mostrados al usuario; la validación real está en el backend. */
const PASSWORD_REQUIREMENTS: {
    label: string;
    test: (value: string) => boolean;
}[] = [
    { label: 'Al menos 10 caracteres', test: (v) => v.length >= 10 },
    {
        label: 'Una letra mayúscula y una minúscula',
        test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v),
    },
    { label: 'Al menos un número', test: (v) => /\d/.test(v) },
    {
        label: 'Al menos un símbolo (por ejemplo ! @ # $)',
        test: (v) => /[^A-Za-z0-9]/.test(v),
    },
];

export default function SetupWelcome({ passwordRules }: Props) {
    const { name } = usePage().props;
    const [password, setPassword] = useState('');

    return (
        <>
            <Head title="Configuración inicial" />

            <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
                <div className="w-full max-w-lg">
                    <div className="mb-6 flex flex-col items-center gap-3 text-center">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-6" />
                        </div>
                        <span className="text-base font-semibold">{name}</span>
                    </div>

                    <div className="rounded-xl border bg-card p-6 sm:p-8">
                        <div className="mb-6 space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
                                <ShieldCheck className="size-4" />
                                Configuración inicial
                            </div>
                            <h1 className="text-xl font-semibold">
                                Cree la cuenta del super administrador
                            </h1>
                            <p className="text-[0.9375rem] text-muted-foreground">
                                Es la primera vez que se usa el sistema. Esta
                                cuenta administrará los talleres, su facturación
                                electrónica y los usuarios. Este formulario se
                                bloquea en cuanto se complete.
                            </p>
                        </div>

                        <Form {...store.form()} className="grid gap-5">
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="first_name">
                                                Nombres
                                            </Label>
                                            <Input
                                                id="first_name"
                                                name="first_name"
                                                required
                                                autoFocus
                                                maxLength={100}
                                                autoComplete="given-name"
                                                aria-invalid={
                                                    !!errors.first_name
                                                }
                                            />
                                            <InputError
                                                message={errors.first_name}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="last_name">
                                                Apellidos
                                            </Label>
                                            <Input
                                                id="last_name"
                                                name="last_name"
                                                required
                                                maxLength={100}
                                                autoComplete="family-name"
                                                aria-invalid={
                                                    !!errors.last_name
                                                }
                                            />
                                            <InputError
                                                message={errors.last_name}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email">
                                            Correo electrónico
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            maxLength={255}
                                            autoComplete="email"
                                            placeholder="admin@empresa.pe"
                                            aria-invalid={!!errors.email}
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">
                                            Contraseña
                                        </Label>
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                            maxLength={128}
                                            autoComplete="new-password"
                                            passwordrules={passwordRules}
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            aria-invalid={!!errors.password}
                                            aria-describedby="password-requirements"
                                        />
                                        <ul
                                            id="password-requirements"
                                            className="grid gap-1 pt-1 text-sm sm:grid-cols-2"
                                        >
                                            {PASSWORD_REQUIREMENTS.map(
                                                (req) => {
                                                    const ok =
                                                        req.test(password);

                                                    return (
                                                        <li
                                                            key={req.label}
                                                            className={cn(
                                                                'flex items-center gap-1.5',
                                                                ok
                                                                    ? 'text-success-foreground'
                                                                    : 'text-muted-foreground',
                                                            )}
                                                        >
                                                            {ok ? (
                                                                <Check className="size-4 shrink-0" />
                                                            ) : (
                                                                <X className="size-4 shrink-0" />
                                                            )}
                                                            {req.label}
                                                        </li>
                                                    );
                                                },
                                            )}
                                        </ul>
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password_confirmation">
                                            Confirmar contraseña
                                        </Label>
                                        <PasswordInput
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            required
                                            maxLength={128}
                                            autoComplete="new-password"
                                            aria-invalid={
                                                !!errors.password_confirmation
                                            }
                                        />
                                        <InputError
                                            message={
                                                errors.password_confirmation
                                            }
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="mt-1 w-full"
                                        disabled={processing}
                                    >
                                        {processing && <Spinner />}
                                        Crear cuenta e ingresar
                                    </Button>
                                </>
                            )}
                        </Form>
                    </div>
                </div>
            </div>
        </>
    );
}
