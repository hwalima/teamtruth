import { useForm } from '@inertiajs/react';
import { ArrowLeft, ImagePlus, Lock, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { route } from 'ziggy-js';
import { Card, Checkbox, Field, Page, Select, TextArea, TextInput, primaryButton, secondaryButton, type Options } from '@/components/hrm/ui';

type Product = {
    id: number;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    category_id: number | null;
    unit_id: number;
    type: string;
    costing_method: string;
    tracking: string;
    is_active: boolean;
    internal_reference: string | null;
    sale_price: string | null;
    cost_price: string | null;
    image_url: string | null;
};

type Props = {
    product: Product | null;
    categories: { value: number; label: string }[];
    units: { value: number; label: string }[];
    types: Options;
    hasStock: boolean;
};

export default function ProductForm({ product, categories, units, types, hasStock }: Props) {
    const editing = product !== null;
    const form = useForm({
        _method: (editing ? 'put' : 'post') as string,
        sku: product?.sku ?? '',
        barcode: product?.barcode ?? '',
        name: product?.name ?? '',
        description: product?.description ?? '',
        internal_reference: product?.internal_reference ?? '',
        category_id: product?.category_id ? String(product.category_id) : '',
        unit_id: product?.unit_id ? String(product.unit_id) : units[0] ? String(units[0].value) : '',
        type: product?.type ?? 'storable',
        costing_method: product?.costing_method ?? 'average',
        tracking: product?.tracking ?? 'none',
        sale_price: product?.sale_price ?? '',
        cost_price: product?.cost_price ?? '',
        is_active: product?.is_active ?? true,
        image: null as File | null,
        remove_image: false as boolean,
    });
    const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);

    useEffect(() => {
        if (!form.data.image) return;
        const url = URL.createObjectURL(form.data.image);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [form.data.image]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, remove_image: data.remove_image ? 1 : 0, is_active: data.is_active ? 1 : 0 }));
        form.post(editing ? route('erp.inventory.products.update', product.id) : route('erp.inventory.products.store'), { forceFormData: true, preserveScroll: true });
    };

    const pickImage = (file: File | null) => {
        form.setData((data) => ({ ...data, image: file, remove_image: false }));
    };
    const clearImage = () => {
        form.setData((data) => ({ ...data, image: null, remove_image: editing && product.image_url !== null }));
        setPreview(null);
    };

    const isService = form.data.type === 'service';
    const locked = (
        <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
            <Lock className="size-3" /> Fixed once stock has moved
        </span>
    );

    return (
        <Page
            title={editing ? `Edit ${product.name}` : 'New product'}
            subtitle={editing ? product.sku : 'Add an item you buy, stock or sell.'}
            actions={
                <a href={editing ? route('erp.inventory.products.show', product.id) : route('erp.inventory.products.index')} className={secondaryButton}>
                    <ArrowLeft className="mr-2 size-4" /> Back
                </a>
            }
        >
            <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[2fr_minmax(0,1fr)]">
                <div className="space-y-4">
                    <Card title="Basics">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Name" error={form.errors.name} className="sm:col-span-2">
                                <TextInput value={form.data.name} onChange={(v) => form.setData('name', v)} required />
                            </Field>
                            <Field label="SKU" error={form.errors.sku}>
                                <TextInput value={form.data.sku} onChange={(v) => form.setData('sku', v)} placeholder="e.g. DRL-BIT-45" required />
                            </Field>
                            <Field label="Internal reference" error={form.errors.internal_reference}>
                                <TextInput value={form.data.internal_reference} onChange={(v) => form.setData('internal_reference', v)} />
                            </Field>
                            <Field label="Barcode" error={form.errors.barcode}>
                                <TextInput value={form.data.barcode} onChange={(v) => form.setData('barcode', v)} />
                            </Field>
                            <Field label="Category" error={form.errors.category_id}>
                                <Select value={form.data.category_id} onChange={(v) => form.setData('category_id', v)} options={categories} placeholder="No category" />
                            </Field>
                            <Field label="Description" error={form.errors.description} className="sm:col-span-2">
                                <TextArea value={form.data.description} onChange={(v) => form.setData('description', v)} rows={4} />
                            </Field>
                        </div>
                    </Card>

                    <Card title="Stock handling">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Type" error={form.errors.type}>
                                <Select
                                    value={form.data.type}
                                    onChange={(v) => form.setData((data) => ({ ...data, type: v, tracking: v === 'service' ? 'none' : data.tracking }))}
                                    options={types}
                                />
                                {hasStock && locked}
                            </Field>
                            <Field label="Unit of measure" error={form.errors.unit_id}>
                                {hasStock ? (
                                    <>
                                        <Select value={form.data.unit_id} onChange={() => undefined} options={units.filter((u) => String(u.value) === form.data.unit_id)} />
                                        {locked}
                                    </>
                                ) : (
                                    <Select value={form.data.unit_id} onChange={(v) => form.setData('unit_id', v)} options={units} />
                                )}
                            </Field>
                            <Field label="Tracking" error={form.errors.tracking}>
                                {hasStock || isService ? (
                                    <>
                                        <Select value={form.data.tracking} onChange={() => undefined} options={{ [form.data.tracking]: trackingLabel(form.data.tracking) }} />
                                        {hasStock && locked}
                                    </>
                                ) : (
                                    <Select value={form.data.tracking} onChange={(v) => form.setData('tracking', v)} options={{ none: 'No tracking', lot: 'By lot', serial: 'By serial number' }} />
                                )}
                            </Field>
                            <Field label="Costing method" error={form.errors.costing_method}>
                                <Select value={form.data.costing_method} onChange={(v) => form.setData('costing_method', v)} options={{ average: 'Average cost', fifo: 'FIFO' }} />
                            </Field>
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card title="Picture">
                        <div className="space-y-3">
                            {preview ? (
                                <div className="relative">
                                    <img src={preview} alt="" className="max-h-56 w-full rounded-xl object-contain ring-1 ring-black/5" />
                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                                        title="Remove picture"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="border-border/80 hover:border-primary/50 hover:bg-primary/5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition">
                                    <ImagePlus className="text-primary size-8" />
                                    <span className="font-medium">Choose a picture</span>
                                    <span className="text-muted-foreground text-xs">JPG, PNG, GIF or WebP, up to 4 MB</span>
                                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
                                </label>
                            )}
                            {form.errors.image && <p className="text-destructive text-xs">{form.errors.image}</p>}
                        </div>
                    </Card>

                    <Card title="Prices">
                        <div className="grid gap-4">
                            <Field label="Sales price" error={form.errors.sale_price}>
                                <TextInput type="number" min="0" step="0.01" value={form.data.sale_price} onChange={(v) => form.setData('sale_price', v)} />
                            </Field>
                            <Field label="Cost price" error={form.errors.cost_price}>
                                <TextInput type="number" min="0" step="0.01" value={form.data.cost_price} onChange={(v) => form.setData('cost_price', v)} />
                            </Field>
                        </div>
                    </Card>

                    <Card>
                        <div className="space-y-4">
                            <Checkbox label="Active (can be bought, stocked and sold)" checked={form.data.is_active} onChange={(v) => form.setData('is_active', v)} />
                            <button type="submit" className={`${primaryButton} w-full`} disabled={form.processing}>
                                <Save className="mr-2 size-4" />
                                {form.processing ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
                            </button>
                        </div>
                    </Card>
                </div>
            </form>
        </Page>
    );
}

function trackingLabel(tracking: string): string {
    return tracking === 'lot' ? 'By lot' : tracking === 'serial' ? 'By serial number' : 'No tracking';
}
