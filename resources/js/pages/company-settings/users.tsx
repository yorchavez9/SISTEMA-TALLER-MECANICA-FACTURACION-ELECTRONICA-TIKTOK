import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { StatusBadge } from '@/components/app/status-badge';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import type { DataTableColumn } from '@/components/data-table/responsive-data-table';
import { ResponsiveDataTable } from '@/components/data-table/responsive-data-table';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTableFilters } from '@/hooks/use-table-filters';
import { formatDateTime } from '@/lib/format';
import {
    index as usersIndex,
    store,
    toggle,
    update,
} from '@/routes/company-settings/users';
import type { Option, Paginated } from '@/types';

type UserRow = {
    id: number;
    first_name: string;
    last_name: string;
    name: string;
    email: string;
    role: string | null;
    role_label: string;
    is_active: boolean;
    last_login_at: string | null;
};

type Props = {
    users: Paginated<UserRow>;
    filters: { search: string };
    roles: Option[];
    passwordRules: string;
};

export default function CompanyUsersPage({
    users,
    filters,
    roles,
    passwordRules,
}: Props) {
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const applyFilters = useTableFilters(usersIndex.url(), filters);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [toToggle, setToToggle] = useState<UserRow | null>(null);
    const [toggling, setToggling] = useState(false);

    const emptyForm = {
        first_name: '',
        last_name: '',
        email: '',
        role: roles[0]?.value ?? '',
        password: '',
        password_confirmation: '',
    };

    const form = useForm({ ...emptyForm });
    const errors = form.errors as Record<string, string>;

    const openCreate = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...emptyForm });
        setDialogOpen(true);
    };

    const openEdit = (row: UserRow) => {
        setEditing(row);
        form.clearErrors();
        form.setData({
            first_name: row.first_name ?? '',
            last_name: row.last_name ?? '',
            email: row.email ?? '',
            role: row.role ?? '',
            password: '',
            password_confirmation: '',
        });
        setDialogOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                setEditing(null);
                form.reset();
            },
            onError: () => form.reset('password', 'password_confirmation'),
        };

        if (editing) {
            form.put(update.url(editing.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    const confirmToggle = () => {
        if (!toToggle) {
            return;
        }

        setToggling(true);
        router.patch(
            toggle.url(toToggle.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setToggling(false);
                    setToToggle(null);
                },
            },
        );
    };

    const columns: DataTableColumn<UserRow>[] = [
        {
            id: 'name',
            header: 'Nombre',
            priority: 'primary',
            cell: (row) => (
                <div className="min-w-0">
                    <p className="font-medium break-words">{row.name}</p>
                    <p className="text-sm break-all text-muted-foreground">
                        {row.email}
                    </p>
                </div>
            ),
        },
        {
            id: 'role',
            header: 'Rol',
            priority: 'primary',
            cell: (row) => row.role_label,
        },
        {
            id: 'status',
            header: 'Estado',
            priority: 'md',
            cell: (row) => (
                <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
            ),
        },
        {
            id: 'last_login_at',
            header: 'Último ingreso',
            priority: 'lg',
            cell: (row) =>
                row.last_login_at ? formatDateTime(row.last_login_at) : 'Nunca',
        },
    ];

    return (
        <>
            <Head title="Usuarios" />

            <SectionCard
                title="Usuarios del taller"
                description="Los usuarios no se eliminan: se desactivan y dejan de poder ingresar."
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        Nuevo usuario
                    </Button>
                }
                flush
            >
                <div className="grid gap-4 p-4">
                    <DataTableToolbar
                        search={filters.search}
                        onSearch={(search) => applyFilters({ search })}
                        searchPlaceholder="Buscar por nombre o correo…"
                    />
                    <InputError message={pageErrors.api} />
                    <ResponsiveDataTable
                        data={users.data}
                        columns={columns}
                        getRowId={(row) => row.id}
                        caption="Usuarios del taller"
                        actions={(row) => [
                            {
                                label: 'Editar',
                                icon: Pencil,
                                onClick: () => openEdit(row),
                            },
                            {
                                label: row.is_active ? 'Desactivar' : 'Activar',
                                icon: row.is_active ? PowerOff : Power,
                                variant: row.is_active
                                    ? 'destructive'
                                    : 'default',
                                onClick: () => setToToggle(row),
                            },
                        ]}
                    />
                    <DataTablePagination paginator={users} />
                </div>
            </SectionCard>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => !form.processing && setDialogOpen(open)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
                    <form onSubmit={submit} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? 'Editar usuario' : 'Nuevo usuario'}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? 'Actualice los datos, el rol o la contraseña del usuario.'
                                    : 'El usuario podrá ingresar con su correo y la contraseña que defina aquí.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label="Nombres"
                                htmlFor="first_name"
                                error={errors.first_name}
                                required
                            >
                                <Input
                                    id="first_name"
                                    value={form.data.first_name}
                                    onChange={(e) =>
                                        form.setData(
                                            'first_name',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={100}
                                    autoComplete="off"
                                    className="h-10"
                                />
                            </FormField>

                            <FormField
                                label="Apellidos"
                                htmlFor="last_name"
                                error={errors.last_name}
                                required
                            >
                                <Input
                                    id="last_name"
                                    value={form.data.last_name}
                                    onChange={(e) =>
                                        form.setData(
                                            'last_name',
                                            e.target.value,
                                        )
                                    }
                                    maxLength={100}
                                    autoComplete="off"
                                    className="h-10"
                                />
                            </FormField>
                        </div>

                        <FormField
                            label="Correo"
                            htmlFor="email"
                            error={errors.email}
                            required
                        >
                            <Input
                                id="email"
                                type="email"
                                value={form.data.email}
                                onChange={(e) =>
                                    form.setData('email', e.target.value)
                                }
                                maxLength={255}
                                autoComplete="off"
                                className="h-10"
                            />
                        </FormField>

                        <FormField
                            label="Rol"
                            htmlFor="role"
                            error={errors.role}
                            required
                        >
                            <SelectInput
                                id="role"
                                value={form.data.role}
                                onChange={(value) =>
                                    form.setData('role', value)
                                }
                                options={roles}
                                invalid={!!errors.role}
                            />
                        </FormField>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <FormField
                                label={
                                    editing ? 'Nueva contraseña' : 'Contraseña'
                                }
                                htmlFor="password"
                                error={errors.password}
                                hint={
                                    editing
                                        ? 'Déjelo vacío para mantener la actual.'
                                        : undefined
                                }
                                required={!editing}
                            >
                                <PasswordInput
                                    id="password"
                                    value={form.data.password}
                                    onChange={(e) =>
                                        form.setData('password', e.target.value)
                                    }
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                    className="h-10"
                                />
                            </FormField>

                            <FormField
                                label="Confirmar contraseña"
                                htmlFor="password_confirmation"
                                error={errors.password_confirmation}
                                required={!editing}
                            >
                                <PasswordInput
                                    id="password_confirmation"
                                    value={form.data.password_confirmation}
                                    onChange={(e) =>
                                        form.setData(
                                            'password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    passwordrules={passwordRules}
                                    className="h-10"
                                />
                            </FormField>
                        </div>

                        <InputError message={errors.api} />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={form.processing}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                {editing ? 'Guardar cambios' : 'Crear usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={toToggle !== null}
                onOpenChange={(open) => !open && setToToggle(null)}
                title={
                    toToggle?.is_active
                        ? `¿Desactivar a ${toToggle?.name}?`
                        : `¿Activar a ${toToggle?.name}?`
                }
                description={
                    toToggle?.is_active
                        ? 'El usuario ya no podrá ingresar al sistema hasta que vuelva a activarlo.'
                        : 'El usuario podrá volver a ingresar al sistema.'
                }
                confirmLabel={toToggle?.is_active ? 'Desactivar' : 'Activar'}
                variant={toToggle?.is_active ? 'destructive' : 'default'}
                processing={toggling}
                onConfirm={confirmToggle}
            />
        </>
    );
}

CompanyUsersPage.layout = {
    breadcrumbs: [
        { title: 'Configuración del taller', href: usersIndex() },
        { title: 'Usuarios', href: usersIndex() },
    ],
};
