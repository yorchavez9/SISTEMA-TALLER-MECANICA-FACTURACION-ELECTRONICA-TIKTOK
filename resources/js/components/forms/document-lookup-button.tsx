import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getJson } from '@/lib/http';
import { document as documentRoute } from '@/routes/lookups';

export type DocumentLookupResult = {
    found: boolean;
    name?: string | null;
    trade_name?: string | null;
    address?: string | null;
    ubigeo?: string | null;
    department?: string | null;
    province?: string | null;
    district?: string | null;
    status?: string | null;
    condition?: string | null;
};

type Props = {
    /** "6" = RUC, "1" = DNI */
    type: '1' | '6';
    number: string;
    onFound: (result: DocumentLookupResult) => void;
    companyId?: number;
    disabled?: boolean;
};

/**
 * Consulta un RUC/DNI en la API (a través del backend) y devuelve los datos.
 */
export function DocumentLookupButton({
    type,
    number,
    onFound,
    companyId,
    disabled,
}: Props) {
    const [loading, setLoading] = useState(false);
    const expectedLength = type === '6' ? 11 : 8;
    const ready = new RegExp(`^\\d{${expectedLength}}$`).test(number);

    const search = async () => {
        setLoading(true);

        try {
            const result = await getJson<DocumentLookupResult>(
                documentRoute.url(),
                {
                    type,
                    number,
                    company: companyId,
                },
            );

            if (result.found) {
                onFound(result);
                toast.success('Datos encontrados.');
            } else {
                toast.info(
                    'No se encontraron datos. Complete los campos manualmente.',
                );
            }
        } catch {
            toast.error('No se pudo realizar la consulta. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0"
            onClick={search}
            disabled={disabled || loading || !ready}
        >
            {loading ? <Spinner /> : <Search />}
            Buscar
        </Button>
    );
}
