import { useEffect, useState } from 'react';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import { Input } from '@/components/ui/input';
import { getJson } from '@/lib/http';
import { ubigeo as ubigeoRoute } from '@/routes/lookups';
import type { Option } from '@/types';

export type UbigeoValue = {
    ubigeo: string;
    department: string;
    province: string;
    district: string;
};

type Props = {
    value: UbigeoValue;
    onChange: (value: UbigeoValue) => void;
    errors?: Partial<Record<keyof UbigeoValue, string>>;
    /** El catálogo de la API está disponible (si no, ingreso manual). */
    lookupsAvailable: boolean;
    /** Solo super admin: usar las credenciales de este taller para consultar. */
    companyId?: number;
};

type CatalogItem = Record<string, unknown>;
type CatalogResponse = { available: boolean; items: CatalogItem[] };

/** Normaliza un ítem del catálogo (los nombres de campo de la API no están documentados). */
function scalar(value: unknown): string | null {
    return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : null;
}

function toOption(item: CatalogItem): Option & { name: string } {
    const id =
        scalar(item.id) ??
        scalar(item.codigo) ??
        scalar(item.ubigeo) ??
        scalar(item.code) ??
        '';
    const name =
        scalar(item.nombre) ??
        scalar(item.name) ??
        scalar(item.descripcion) ??
        id;

    return { value: id, label: name, name };
}

/**
 * Departamento → provincia → distrito con el catálogo de la API, o ingreso
 * manual (incluido el código de ubigeo de 6 dígitos) si no está disponible.
 */
export function UbigeoFields({
    value,
    onChange,
    errors = {},
    lookupsAvailable,
    companyId,
}: Props) {
    const [manual, setManual] = useState(!lookupsAvailable);
    const [regions, setRegions] = useState<ReturnType<typeof toOption>[]>([]);
    const [provinces, setProvinces] = useState<ReturnType<typeof toOption>[]>(
        [],
    );
    const [districts, setDistricts] = useState<ReturnType<typeof toOption>[]>(
        [],
    );
    const [regionId, setRegionId] = useState('');
    const [provinceId, setProvinceId] = useState('');

    const load = async (level: string, parent?: string) => {
        const data = await getJson<CatalogResponse>(ubigeoRoute.url(), {
            level,
            parent,
            company: companyId,
        });

        if (!data.available) {
            setManual(true);
        }

        return data.items.map(toOption);
    };

    useEffect(() => {
        if (manual) {
            return;
        }

        load('regions')
            .then(setRegions)
            .catch(() => setManual(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manual]);

    const selectRegion = (id: string) => {
        setRegionId(id);
        setProvinceId('');
        setProvinces([]);
        setDistricts([]);
        const region = regions.find((r) => r.value === id);
        onChange({
            ...value,
            department: region?.name.toUpperCase() ?? '',
            province: '',
            district: '',
            ubigeo: '',
        });
        load('provinces', id)
            .then(setProvinces)
            .catch(() => setManual(true));
    };

    const selectProvince = (id: string) => {
        setProvinceId(id);
        setDistricts([]);
        const province = provinces.find((p) => p.value === id);
        onChange({
            ...value,
            province: province?.name.toUpperCase() ?? '',
            district: '',
            ubigeo: '',
        });
        load('districts', id)
            .then(setDistricts)
            .catch(() => setManual(true));
    };

    const selectDistrict = (id: string) => {
        const district = districts.find((d) => d.value === id);
        onChange({
            ...value,
            district: district?.name.toUpperCase() ?? '',
            ubigeo: id,
        });
    };

    if (manual) {
        return (
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    label="Departamento"
                    htmlFor="department"
                    error={errors.department}
                    required
                >
                    <Input
                        id="department"
                        value={value.department}
                        onChange={(e) =>
                            onChange({ ...value, department: e.target.value })
                        }
                        maxLength={60}
                        className="h-10"
                    />
                </FormField>
                <FormField
                    label="Provincia"
                    htmlFor="province"
                    error={errors.province}
                    required
                >
                    <Input
                        id="province"
                        value={value.province}
                        onChange={(e) =>
                            onChange({ ...value, province: e.target.value })
                        }
                        maxLength={60}
                        className="h-10"
                    />
                </FormField>
                <FormField
                    label="Distrito"
                    htmlFor="district"
                    error={errors.district}
                    required
                >
                    <Input
                        id="district"
                        value={value.district}
                        onChange={(e) =>
                            onChange({ ...value, district: e.target.value })
                        }
                        maxLength={60}
                        className="h-10"
                    />
                </FormField>
                <FormField
                    label="Ubigeo"
                    htmlFor="ubigeo"
                    error={errors.ubigeo}
                    hint="Código INEI de 6 dígitos (ej. 150101)."
                    required
                >
                    <Input
                        id="ubigeo"
                        value={value.ubigeo}
                        onChange={(e) =>
                            onChange({
                                ...value,
                                ubigeo: e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 6),
                            })
                        }
                        inputMode="numeric"
                        maxLength={6}
                        className="h-10 tabular-nums"
                    />
                </FormField>
            </div>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <FormField
                label="Departamento"
                htmlFor="department"
                error={errors.department}
                hint={
                    value.department && !regionId
                        ? `Actual: ${value.department}`
                        : undefined
                }
                required
            >
                <SelectInput
                    id="department"
                    value={regionId}
                    onChange={selectRegion}
                    options={regions}
                    placeholder={value.department || 'Seleccione…'}
                />
            </FormField>
            <FormField
                label="Provincia"
                htmlFor="province"
                error={errors.province}
                hint={
                    value.province && !provinceId
                        ? `Actual: ${value.province}`
                        : undefined
                }
                required
            >
                <SelectInput
                    id="province"
                    value={provinceId}
                    onChange={selectProvince}
                    options={provinces}
                    disabled={!regionId}
                    placeholder={value.province || 'Seleccione…'}
                />
            </FormField>
            <FormField
                label="Distrito"
                htmlFor="district"
                error={errors.district}
                hint={
                    value.district && !provinceId
                        ? `Actual: ${value.district}`
                        : undefined
                }
                required
            >
                <SelectInput
                    id="district"
                    value={
                        districts.some((d) => d.value === value.ubigeo)
                            ? value.ubigeo
                            : ''
                    }
                    onChange={selectDistrict}
                    options={districts}
                    disabled={!provinceId}
                    placeholder={value.district || 'Seleccione…'}
                />
            </FormField>
            <FormField
                label="Ubigeo"
                htmlFor="ubigeo-readonly"
                error={errors.ubigeo}
            >
                <Input
                    id="ubigeo-readonly"
                    value={value.ubigeo}
                    readOnly
                    className="h-10 bg-muted/50 tabular-nums"
                />
            </FormField>
        </div>
    );
}
