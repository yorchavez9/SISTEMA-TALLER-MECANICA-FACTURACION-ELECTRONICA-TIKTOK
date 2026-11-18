import { Link, usePage } from '@inertiajs/react';
import { Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { leave } from '@/routes/admin/companies';

/**
 * Aviso visible cuando el super admin está operando dentro de un taller,
 * con el atajo para salir. Además marca el entorno beta (pruebas).
 */
export function CompanyContextBanner() {
    const { company } = usePage().props;

    if (!company) {
        return null;
    }

    const isBeta = company.environment === 'beta';

    if (!company.acting_as_admin && !isBeta) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 border-b bg-accent/60 px-4 py-2 text-[0.9375rem] text-accent-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
            <p className="flex min-w-0 items-center gap-2">
                <Building2 className="size-4 shrink-0" />
                <span className="truncate">
                    {company.acting_as_admin ? (
                        <>
                            Operando en{' '}
                            <strong className="font-semibold">
                                {company.name}
                            </strong>
                        </>
                    ) : (
                        company.name
                    )}
                    {isBeta &&
                        ' · Entorno de pruebas (beta): los comprobantes no tienen validez tributaria.'}
                </span>
            </p>
            {company.acting_as_admin && (
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 bg-background"
                >
                    <Link href={leave()} as="button">
                        <LogOut />
                        Salir del taller
                    </Link>
                </Button>
            )}
        </div>
    );
}
