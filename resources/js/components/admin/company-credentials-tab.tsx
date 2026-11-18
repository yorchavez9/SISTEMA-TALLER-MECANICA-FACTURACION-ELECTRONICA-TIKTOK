import { router, useForm } from '@inertiajs/react';
import { KeyRound, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
    BillingDetail,
    CompanyDetail,
} from '@/components/admin/company-shared';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { SectionCard } from '@/components/app/section-card';
import { FormField } from '@/components/forms/form-field';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
    recover,
    regenerate,
    verify,
} from '@/routes/admin/companies/billing/credentials';
import { destroy } from '@/routes/admin/companies/billing/tenant';

type Props = {
    company: CompanyDetail;
    billing: BillingDetail | null;
};

/** Pestaña "Credenciales API". */
export function CompanyCredentialsTab({ company, billing }: Props) {
    const connected = billing?.connected ?? false;
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const [running, setRunning] = useState<'regenerate' | 'recover' | null>(
        null,
    );
    const [deleteOpen, setDeleteOpen] = useState(false);

    const tokenForm = useForm({ token: '' });
    const deleteForm = useForm({ confirmation: '' });
    const tokenApiError = (
        tokenForm.errors as Record<string, string | undefined>
    ).api;
    const deleteApiError = (
        deleteForm.errors as Record<string, string | undefined>
    ).api;

    const confirmRegenerate = () => {
        setRunning('regenerate');
        router.post(
            regenerate.url(company.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => {
                    setRunning(null);
                    setRegenerateOpen(false);
                },
            },
        );
    };

    const requestRecovery = () => {
        setRunning('recover');
        router.post(
            recover.url(company.id),
            {},
            { preserveScroll: true, onFinish: () => setRunning(null) },
        );
    };

    const submitToken = (e: FormEvent) => {
        e.preventDefault();
        tokenForm.post(verify.url(company.id), {
            preserveScroll: true,
            onSuccess: () => tokenForm.reset(),
        });
    };

    const submitDelete = (e: FormEvent) => {
        e.preventDefault();
        deleteForm.delete(destroy.url(company.id), {
            preserveScroll: true,
            onSuccess: () => {
                setDeleteOpen(false);
                deleteForm.reset();
            },
        });
    };

    return (
        <div className="grid gap-6">
            <SectionCard
                title="Credenciales de la API"
                description="Las credenciales (API key y secret) con las que el sistema opera en nombre del taller se guardan cifradas y nunca se muestran."
            >
                <div className="grid gap-5">
                    <Alert>
                        <ShieldCheck />
                        <AlertDescription className="text-[0.9375rem]">
                            Si sospecha que las credenciales se filtraron,
                            regenérelas: las anteriores dejan de funcionar al
                            instante. Si se perdieron (por ejemplo, el registro
                            quedó incompleto), recupérelas con el token que la
                            API envía al correo registrado del taller.
                        </AlertDescription>
                    </Alert>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setRegenerateOpen(true)}
                            disabled={!connected || running !== null}
                        >
                            <KeyRound />
                            Regenerar credenciales
                        </Button>
                        <Button
                            variant="outline"
                            onClick={requestRecovery}
                            disabled={running !== null}
                        >
                            {running === 'recover' ? <Spinner /> : <Mail />}
                            Recuperar credenciales
                        </Button>
                    </div>
                    {!connected && (
                        <p className="text-sm text-muted-foreground">
                            Regenerar solo está disponible cuando el taller
                            tiene credenciales activas.
                        </p>
                    )}
                </div>
            </SectionCard>

            <form onSubmit={submitToken}>
                <SectionCard
                    title="Verificar token de recuperación"
                    description="Pegue el token de 64 caracteres que llegó al correo registrado del taller."
                    footer={
                        <Button
                            type="submit"
                            disabled={
                                tokenForm.processing ||
                                tokenForm.data.token.length !== 64
                            }
                        >
                            {tokenForm.processing && <Spinner />}
                            Verificar token
                        </Button>
                    }
                >
                    <div className="grid gap-3">
                        <FormField
                            label="Token"
                            htmlFor="recovery_token"
                            error={tokenForm.errors.token}
                            hint={`${tokenForm.data.token.length} / 64 caracteres`}
                        >
                            <Input
                                id="recovery_token"
                                value={tokenForm.data.token}
                                onChange={(e) =>
                                    tokenForm.setData(
                                        'token',
                                        e.target.value.trim().slice(0, 64),
                                    )
                                }
                                maxLength={64}
                                autoComplete="off"
                                spellCheck={false}
                                className="h-10 font-mono text-sm"
                            />
                        </FormField>
                        <InputError message={tokenApiError} />
                    </div>
                </SectionCard>
            </form>

            <section className="min-w-0 rounded-xl border border-destructive/40 bg-card">
                <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                        <h2 className="text-base font-semibold text-destructive-foreground">
                            Zona de peligro
                        </h2>
                        <p className="text-[0.9375rem] text-muted-foreground">
                            Elimina el taller y todos sus datos en la API de
                            facturación. Es irreversible. Los datos locales del
                            sistema se conservan y podrá volver a registrarlo.
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        className="shrink-0"
                        onClick={() => {
                            deleteForm.clearErrors();
                            deleteForm.reset();
                            setDeleteOpen(true);
                        }}
                        disabled={!connected}
                    >
                        <Trash2 />
                        Eliminar taller de la API
                    </Button>
                </div>
            </section>

            <ConfirmDialog
                open={regenerateOpen}
                onOpenChange={setRegenerateOpen}
                title="¿Regenerar las credenciales?"
                description="Las credenciales actuales dejarán de funcionar de inmediato. El sistema guardará las nuevas automáticamente."
                confirmLabel="Regenerar"
                variant="destructive"
                processing={running === 'regenerate'}
                onConfirm={confirmRegenerate}
            />

            <Dialog
                open={deleteOpen}
                onOpenChange={(next) =>
                    !deleteForm.processing && setDeleteOpen(next)
                }
            >
                <DialogContent className="sm:max-w-lg">
                    <form onSubmit={submitDelete} className="grid gap-5">
                        <DialogHeader>
                            <DialogTitle>Eliminar taller de la API</DialogTitle>
                            <DialogDescription className="text-[0.9375rem]">
                                Se eliminarán en la API la empresa, sus
                                sucursales, series, certificado y credenciales.
                                Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>

                        <FormField
                            label={`Escriba el RUC ${company.ruc} para confirmar`}
                            htmlFor="delete_confirmation"
                            error={deleteForm.errors.confirmation}
                            required
                        >
                            <Input
                                id="delete_confirmation"
                                value={deleteForm.data.confirmation}
                                onChange={(e) =>
                                    deleteForm.setData(
                                        'confirmation',
                                        e.target.value
                                            .replace(/\D/g, '')
                                            .slice(0, 11),
                                    )
                                }
                                inputMode="numeric"
                                autoComplete="off"
                                className="h-10 tabular-nums"
                            />
                        </FormField>

                        <InputError message={deleteApiError} />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteOpen(false)}
                                disabled={deleteForm.processing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={
                                    deleteForm.processing ||
                                    deleteForm.data.confirmation !== company.ruc
                                }
                            >
                                {deleteForm.processing && <Spinner />}
                                Eliminar definitivamente
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
