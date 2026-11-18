import { Form, Head, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Profile({ status }: { status?: string }) {
    const { auth } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Configuración del perfil" />

            <h1 className="sr-only">Configuración del perfil</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Perfil"
                    description="Actualice sus nombres, apellidos y correo electrónico"
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="first_name">Nombres</Label>

                                    <Input
                                        id="first_name"
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            auth.user?.first_name ?? ''
                                        }
                                        name="first_name"
                                        required
                                        autoComplete="given-name"
                                        placeholder="Nombres"
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.first_name}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="last_name">Apellidos</Label>

                                    <Input
                                        id="last_name"
                                        className="mt-1 block w-full"
                                        defaultValue={
                                            auth.user?.last_name ?? ''
                                        }
                                        name="last_name"
                                        required
                                        autoComplete="family-name"
                                        placeholder="Apellidos"
                                    />

                                    <InputError
                                        className="mt-2"
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
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user?.email ?? ''}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="correo@ejemplo.com"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    Guardar
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Configuración del perfil',
            href: edit(),
        },
    ],
};
