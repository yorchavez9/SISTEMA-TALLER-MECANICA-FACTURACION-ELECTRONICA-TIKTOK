import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { PageContainer, PageHeader } from '@/components/app/page-header';
import { SectionCard } from '@/components/app/section-card';
import { FormField } from '@/components/forms/form-field';
import { SelectInput } from '@/components/forms/select-input';
import InputError from '@/components/input-error';
import { ImageUpload } from '@/components/media/image-upload';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney, formatQuantity } from '@/lib/format';
import {
    create,
    edit,
    index as productsIndex,
    show,
    store,
    update,
} from '@/routes/products';
import type { Option } from '@/types';
import type { ProductRow } from './index';

type ProductDetail = ProductRow & {
    description: string | null;
    image_url: string | null;
};

type Props = {
    product: ProductDetail | null;
    units: Option[];
    igvAffectations: Option[];
};

type ProductFormData = {
    code: string;
    name: string;
    description: string;
    sale_price: string;
    cost: string;
    unit: string;
    igv_affectation: string;
    min_stock: string;
    initial_stock: string;
    sunat_product_code: string;
    is_active: boolean;
    image: File | null;
    remove_image: boolean;
};

export default function ProductForm({
    product,
    units,
    igvAffectations,
}: Props) {
    const editing = product !== null;

    const form = useForm<ProductFormData>({
        code: product?.code ?? '',
        name: product?.name ?? '',
        description: product?.description ?? '',
        sale_price: product?.sale_price ?? '',
        cost: product?.cost ?? '',
        unit: product?.unit ?? 'NIU',
        igv_affectation: product?.igv_affectation ?? '10',
        min_stock: product?.min_stock ?? '',
        initial_stock: '',
        sunat_product_code: product?.sunat_product_code ?? '',
        is_active: product?.is_active ?? true,
        image: null,
        remove_image: false,
    });
    const errors = form.errors as Record<string, string>;

    const salePrice = Number(form.data.sale_price);
    const cost = Number(form.data.cost);
    const showMargin = cost > 0 && salePrice > 0;
    const margin = salePrice - cost;
    const marginPercent = showMargin ? (margin / salePrice) * 100 : 0;

    const submit = (e: FormEvent) => {
        e.preventDefault();

        if (product) {
            form.transform((data) => {
                // El stock inicial solo se envía al crear (el backend lo prohíbe al editar).
                const { initial_stock: _omit, image, ...rest } = data;
                void _omit;

                return {
                    ...rest,
                    ...(image ? { image } : {}),
                    _method: 'put',
                };
            });
            form.post(update.url(product.id), {
                forceFormData: true,
                preserveScroll: true,
            });

            return;
        }

        form.transform((data) => {
            const { image, ...rest } = data;

            return { ...rest, ...(image ? { image } : {}) };
        });
        form.post(store.url(), { forceFormData: true, preserveScroll: true });
    };

    const title = editing ? 'Editar producto' : 'Nuevo producto';

    return (
        <>
            <Head title={title} />

            <PageContainer>
                <PageHeader
                    title={title}
                    description={
                        editing
                            ? `${product.code} · ${product.name}`
                            : 'Registre un repuesto o producto del inventario.'
                    }
                />

                <form onSubmit={submit} className="grid gap-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                        <SectionCard title="Datos del producto">
                            <div className="grid gap-5">
                                <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
                                    <FormField
                                        label="Código"
                                        htmlFor="code"
                                        error={errors.code}
                                        required
                                    >
                                        <Input
                                            id="code"
                                            value={form.data.code}
                                            onChange={(e) =>
                                                form.setData(
                                                    'code',
                                                    e.target.value.toUpperCase(),
                                                )
                                            }
                                            maxLength={40}
                                            autoComplete="off"
                                            className="h-10 uppercase"
                                        />
                                    </FormField>

                                    <FormField
                                        label="Nombre"
                                        htmlFor="name"
                                        error={errors.name}
                                        required
                                    >
                                        <Input
                                            id="name"
                                            value={form.data.name}
                                            onChange={(e) =>
                                                form.setData(
                                                    'name',
                                                    e.target.value,
                                                )
                                            }
                                            maxLength={150}
                                            autoComplete="off"
                                            className="h-10"
                                        />
                                    </FormField>
                                </div>

                                <FormField
                                    label="Descripción"
                                    htmlFor="description"
                                    error={errors.description}
                                >
                                    <Textarea
                                        id="description"
                                        value={form.data.description}
                                        onChange={(e) =>
                                            form.setData(
                                                'description',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={2000}
                                        rows={3}
                                        className="text-[0.9375rem]"
                                    />
                                </FormField>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <FormField
                                        label="Precio de venta (con IGV)"
                                        htmlFor="sale_price"
                                        error={errors.sale_price}
                                        required
                                    >
                                        <Input
                                            id="sale_price"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min={0}
                                            value={form.data.sale_price}
                                            onChange={(e) =>
                                                form.setData(
                                                    'sale_price',
                                                    e.target.value,
                                                )
                                            }
                                            className="h-10 tabular-nums"
                                        />
                                    </FormField>

                                    <FormField
                                        label="Costo"
                                        htmlFor="cost"
                                        error={errors.cost}
                                    >
                                        <Input
                                            id="cost"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min={0}
                                            value={form.data.cost}
                                            onChange={(e) =>
                                                form.setData(
                                                    'cost',
                                                    e.target.value,
                                                )
                                            }
                                            className="h-10 tabular-nums"
                                        />
                                    </FormField>
                                </div>

                                {showMargin && (
                                    <p
                                        className={
                                            margin < 0
                                                ? 'text-sm text-destructive-foreground'
                                                : 'text-sm text-muted-foreground'
                                        }
                                    >
                                        Margen: {formatMoney(margin)} (
                                        {marginPercent.toLocaleString('es-PE', {
                                            maximumFractionDigits: 1,
                                        })}{' '}
                                        %)
                                    </p>
                                )}

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <FormField
                                        label="Unidad de medida"
                                        htmlFor="unit"
                                        error={errors.unit}
                                        required
                                    >
                                        <SelectInput
                                            id="unit"
                                            value={form.data.unit}
                                            onChange={(value) =>
                                                form.setData('unit', value)
                                            }
                                            options={units}
                                            invalid={!!errors.unit}
                                        />
                                    </FormField>

                                    <FormField
                                        label="Afectación IGV"
                                        htmlFor="igv_affectation"
                                        error={errors.igv_affectation}
                                        required
                                    >
                                        <SelectInput
                                            id="igv_affectation"
                                            value={form.data.igv_affectation}
                                            onChange={(value) =>
                                                form.setData(
                                                    'igv_affectation',
                                                    value,
                                                )
                                            }
                                            options={igvAffectations}
                                            invalid={!!errors.igv_affectation}
                                        />
                                    </FormField>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    {editing ? (
                                        <FormField
                                            label="Stock actual"
                                            htmlFor="current_stock"
                                            hint="Use Ajustar stock en el detalle del producto"
                                        >
                                            <Input
                                                id="current_stock"
                                                value={`${formatQuantity(product.stock)} ${product.unit}`}
                                                readOnly
                                                disabled
                                                className="h-10 tabular-nums"
                                            />
                                        </FormField>
                                    ) : (
                                        <FormField
                                            label="Stock inicial"
                                            htmlFor="initial_stock"
                                            error={errors.initial_stock}
                                            hint="Opcional. Se registra como entrada de inventario."
                                        >
                                            <Input
                                                id="initial_stock"
                                                type="number"
                                                inputMode="decimal"
                                                step="0.001"
                                                min={0}
                                                value={form.data.initial_stock}
                                                onChange={(e) =>
                                                    form.setData(
                                                        'initial_stock',
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-10 tabular-nums"
                                            />
                                        </FormField>
                                    )}

                                    <FormField
                                        label="Stock mínimo"
                                        htmlFor="min_stock"
                                        error={errors.min_stock}
                                        hint="Opcional. Se avisa cuando el stock llega a este valor."
                                    >
                                        <Input
                                            id="min_stock"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.001"
                                            min={0}
                                            value={form.data.min_stock}
                                            onChange={(e) =>
                                                form.setData(
                                                    'min_stock',
                                                    e.target.value,
                                                )
                                            }
                                            className="h-10 tabular-nums"
                                        />
                                    </FormField>
                                </div>

                                <FormField
                                    label="Código de producto SUNAT"
                                    htmlFor="sunat_product_code"
                                    error={errors.sunat_product_code}
                                    hint="Opcional. 8 dígitos del catálogo SUNAT."
                                >
                                    <Input
                                        id="sunat_product_code"
                                        value={form.data.sunat_product_code}
                                        onChange={(e) =>
                                            form.setData(
                                                'sunat_product_code',
                                                e.target.value
                                                    .replace(/\D/g, '')
                                                    .slice(0, 8),
                                            )
                                        }
                                        inputMode="numeric"
                                        maxLength={8}
                                        autoComplete="off"
                                        className="h-10 tabular-nums sm:max-w-48"
                                    />
                                </FormField>

                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="is_active"
                                        checked={form.data.is_active}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'is_active',
                                                checked === true,
                                            )
                                        }
                                        className="mt-0.5"
                                    />
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor="is_active"
                                            className="text-[0.9375rem]"
                                        >
                                            Activo
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Los productos inactivos no se
                                            ofrecen al registrar órdenes ni
                                            ventas.
                                        </p>
                                        <InputError
                                            message={errors.is_active}
                                        />
                                    </div>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Imagen">
                            <ImageUpload
                                currentUrl={product?.image_url ?? null}
                                file={form.data.image}
                                removed={form.data.remove_image}
                                onChange={({ file, removed }) =>
                                    form.setData((data) => ({
                                        ...data,
                                        image: file,
                                        remove_image: removed,
                                    }))
                                }
                                error={errors.image ?? errors.remove_image}
                                alt={form.data.name || 'Imagen del producto'}
                            />
                        </SectionCard>
                    </div>

                    <InputError message={errors.api} />

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link
                                href={
                                    product ? show(product.id) : productsIndex()
                                }
                            >
                                Cancelar
                            </Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            {editing ? 'Guardar cambios' : 'Guardar producto'}
                        </Button>
                    </div>
                </form>
            </PageContainer>
        </>
    );
}

ProductForm.layout = (props: Props) => ({
    breadcrumbs: props.product
        ? [
              { title: 'Productos y repuestos', href: productsIndex() },
              {
                  title: props.product.name,
                  href: show(props.product.id),
              },
              { title: 'Editar', href: edit(props.product.id) },
          ]
        : [
              { title: 'Productos y repuestos', href: productsIndex() },
              { title: 'Nuevo producto', href: create() },
          ],
});
