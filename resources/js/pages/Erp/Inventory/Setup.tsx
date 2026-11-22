import { useForm } from '@inertiajs/react';
import { Boxes, FolderTree, MapPin, Package, Pencil as PencilIcon, Plus, Ruler, Upload, Warehouse as WarehouseIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { route } from 'ziggy-js';
import { ActionButton, RecordActions, useConfirmDelete } from '@/components/erp/record-actions';
import { Card, Checkbox, Empty, Field, Page, Select, TextArea, TextInput, humanize, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActiveBadge } from './Products/Index';

type Unit = { id: number; name: string; abbreviation: string; category: string; factor_to_base: string; is_base: boolean; is_active: boolean; products_count: number };
type Category = { id: number; name: string; description: string | null; parent_id: number | null; is_active: boolean; products_count: number };
type Location = { id: number; warehouse_id: number; parent_id: number | null; code: string; name: string; usage: string; is_active: boolean };
type Warehouse = { id: number; code: string; name: string; address: string | null; is_active: boolean; locations: Location[] };
type Props = {
    company: { id: number; code: string; name: string };
    units: Unit[];
    categories: Category[];
    warehouses: Warehouse[];
    productCount: number;
    canManage: boolean;
};

const unitCategories = Object.fromEntries(['quantity', 'weight', 'length', 'volume', 'time', 'other'].map((c) => [c, humanize(c)]));
const locationUsages = Object.fromEntries(['internal', 'supplier', 'customer', 'department', 'production', 'scrap', 'adjustment'].map((u) => [u, humanize(u)]));

export default function Setup({ company, units, categories, warehouses, productCount, canManage }: Props) {
    const { askDelete, deleteDialog } = useConfirmDelete();

    return (
        <Page
            title="Categories, units & warehouses"
            subtitle={`The building blocks products and stock rely on in ${company.name}.`}
            actions={
                <>
                    <a href={route('erp.data-import.index')} className={secondaryButton}>
                        <Upload className="mr-2 size-4" /> Import from Odoo
                    </a>
                    <a href={route('erp.inventory.products.index')} className={primaryButton}>
                        <Package className="mr-2 size-4" /> Products ({productCount.toLocaleString()})
                    </a>
                </>
            }
        >
            <div className="grid gap-3 sm:grid-cols-4">
                <Tile icon={FolderTree} label="Categories" value={categories.length} />
                <Tile icon={Ruler} label="Units of measure" value={units.length} />
                <Tile icon={WarehouseIcon} label="Warehouses" value={warehouses.length} />
                <Tile icon={MapPin} label="Stock locations" value={warehouses.reduce((sum, w) => sum + w.locations.length, 0)} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Categories categories={categories} canManage={canManage} askDelete={askDelete} />
                <Units units={units} canManage={canManage} askDelete={askDelete} />
            </div>
            <Warehouses warehouses={warehouses} canManage={canManage} askDelete={askDelete} />
            {deleteDialog}
        </Page>
    );
}

type AskDelete = ReturnType<typeof useConfirmDelete>['askDelete'];

function Tile({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: number }) {
    return (
        <div className="bg-card flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Icon className="size-5" />
            </div>
            <div>
                <div className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
                <div className="text-muted-foreground text-xs">{label}</div>
            </div>
        </div>
    );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return <ActionButton icon={Plus} label={label} tone="view" onClick={onClick} showLabel />;
}

function FormDialog({
    open,
    title,
    description,
    onClose,
    onSubmit,
    processing,
    children,
}: {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    onSubmit: (event: FormEvent) => void;
    processing: boolean;
    children: ReactNode;
}) {
    return (
        <Dialog open={open} onOpenChange={(value) => !value && !processing && onClose()}>
            <DialogContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                    <div className="grid gap-4">{children}</div>
                    <DialogFooter className="gap-2">
                        <button type="button" className={secondaryButton} onClick={onClose} disabled={processing}>
                            Cancel
                        </button>
                        <button type="submit" className={primaryButton} disabled={processing}>
                            {processing ? 'Saving…' : 'Save'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
    return (
        <div className="-mx-4 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[520px] text-sm">
                <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs font-medium tracking-wide uppercase [&>th]:px-3 [&>th]:py-2.5 [&>th:first-child]:pl-4 sm:[&>th:first-child]:pl-6 [&>th:last-child]:pr-4 sm:[&>th:last-child]:pr-6">
                        {head}
                    </tr>
                </thead>
                <tbody className="divide-y [&_td]:px-3 [&_td]:py-2.5 [&_td:first-child]:pl-4 sm:[&_td:first-child]:pl-6 [&_td:last-child]:pr-4 sm:[&_td:last-child]:pr-6 [&>tr:hover]:bg-muted/30">
                    {children}
                </tbody>
            </table>
        </div>
    );
}

/* ---------------------------------------------------------------- categories */

function Categories({ categories, canManage, askDelete }: { categories: Category[]; canManage: boolean; askDelete: AskDelete }) {
    const [editing, setEditing] = useState<Category | 'new' | null>(null);
    const form = useForm({ name: '', description: '', parent_id: '', is_active: true as boolean });
    const byId = new Map(categories.map((c) => [c.id, c]));
    const path = (category: Category) => {
        const names = [category.name];
        const seen = new Set([category.id]);
        let parent = category.parent_id ? byId.get(category.parent_id) : undefined;
        while (parent && !seen.has(parent.id)) {
            names.unshift(parent.name);
            seen.add(parent.id);
            parent = parent.parent_id ? byId.get(parent.parent_id) : undefined;
        }
        return names.join(' / ');
    };
    const sorted = [...categories].sort((a, b) => path(a).localeCompare(path(b)));

    const open = (category: Category | 'new') => {
        form.clearErrors();
        form.setData(
            category === 'new'
                ? { name: '', description: '', parent_id: '', is_active: true }
                : { name: category.name, description: category.description ?? '', parent_id: category.parent_id ? String(category.parent_id) : '', is_active: category.is_active },
        );
        setEditing(category);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing === 'new') form.post(route('erp.inventory.categories.store'), options);
        else if (editing) form.put(route('erp.inventory.categories.update', editing.id), options);
    };

    return (
        <Card title="Product categories" actions={canManage && <AddButton label="Add category" onClick={() => open('new')} />}>
            {categories.length === 0 ? (
                <Empty>No categories yet.</Empty>
            ) : (
                <Table
                    head={
                        <>
                            <th>Category</th>
                            <th className="text-right">Products</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </>
                    }
                >
                    {sorted.map((category) => (
                        <tr key={category.id}>
                            <td>
                                <div className="font-medium">{path(category)}</div>
                                {category.description && <div className="text-muted-foreground line-clamp-1 text-xs">{category.description}</div>}
                            </td>
                            <td className="text-right tabular-nums">
                                <a href={route('erp.inventory.products.index', { category_id: category.id })} className="hover:text-primary underline-offset-2 hover:underline">
                                    {category.products_count}
                                </a>
                            </td>
                            <td>
                                <ActiveBadge active={category.is_active} />
                            </td>
                            <td>
                                <div className="flex justify-end gap-1.5">
                                    <RecordActions viewHref={route('erp.inventory.products.index', { category_id: category.id })} />
                                    {canManage && <EditButton onClick={() => open(category)} />}
                                    {canManage && (
                                        <RecordActions
                                            onDelete={() =>
                                                askDelete({
                                                    url: route('erp.inventory.categories.destroy', category.id),
                                                    title: `Delete ${category.name}?`,
                                                    description: 'Only an empty category can be deleted: move its products and sub-categories first, or mark it inactive.',
                                                })
                                            }
                                        />
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
            <FormDialog
                open={editing !== null}
                title={editing === 'new' ? 'New category' : `Edit ${editing?.name ?? ''}`}
                onClose={() => setEditing(null)}
                onSubmit={submit}
                processing={form.processing}
            >
                <Field label="Name" error={form.errors.name}>
                    <TextInput value={form.data.name} onChange={(v) => form.setData('name', v)} required />
                </Field>
                <Field label="Inside" error={form.errors.parent_id}>
                    <Select
                        value={form.data.parent_id}
                        onChange={(v) => form.setData('parent_id', v)}
                        options={sorted.filter((c) => editing === 'new' || c.id !== editing?.id).map((c) => ({ value: c.id, label: path(c) }))}
                        placeholder="Top level"
                    />
                </Field>
                <Field label="Description" error={form.errors.description}>
                    <TextArea value={form.data.description} onChange={(v) => form.setData('description', v)} />
                </Field>
                {editing !== 'new' && <Checkbox label="Active" checked={form.data.is_active} onChange={(v) => form.setData('is_active', v)} />}
            </FormDialog>
        </Card>
    );
}

function EditButton({ onClick }: { onClick: () => void }) {
    return <ActionButton icon={PencilIcon} label="Edit" tone="edit" onClick={onClick} />;
}

/* --------------------------------------------------------------------- units */

function Units({ units, canManage, askDelete }: { units: Unit[]; canManage: boolean; askDelete: AskDelete }) {
    const [editing, setEditing] = useState<Unit | 'new' | null>(null);
    const form = useForm({ name: '', abbreviation: '', category: 'quantity', factor_to_base: '1', is_base: false as boolean, is_active: true as boolean });

    const open = (unit: Unit | 'new') => {
        form.clearErrors();
        form.setData(
            unit === 'new'
                ? { name: '', abbreviation: '', category: 'quantity', factor_to_base: '1', is_base: !units.some((u) => u.category === 'quantity' && u.is_base), is_active: true }
                : { name: unit.name, abbreviation: unit.abbreviation, category: unit.category, factor_to_base: String(unit.factor_to_base), is_base: unit.is_base, is_active: unit.is_active },
        );
        setEditing(unit);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setEditing(null) };
        if (editing === 'new') form.post(route('erp.inventory.units.store'), options);
        else if (editing) form.put(route('erp.inventory.units.update', editing.id), options);
    };

    return (
        <Card title="Units of measure" actions={canManage && <AddButton label="Add unit" onClick={() => open('new')} />}>
            {units.length === 0 ? (
                <Empty>No units yet. Products need at least one, such as "Each (ea)".</Empty>
            ) : (
                <Table
                    head={
                        <>
                            <th>Unit</th>
                            <th>Kind</th>
                            <th className="text-right">Products</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </>
                    }
                >
                    {units.map((unit) => (
                        <tr key={unit.id}>
                            <td>
                                <span className="font-medium">{unit.name}</span> <span className="text-muted-foreground">({unit.abbreviation})</span>
                            </td>
                            <td className="text-muted-foreground">
                                {humanize(unit.category)}
                                {unit.is_base ? ' · base' : ` · ×${Number(unit.factor_to_base)}`}
                            </td>
                            <td className="text-right tabular-nums">{unit.products_count}</td>
                            <td>
                                <ActiveBadge active={unit.is_active} />
                            </td>
                            <td>
                                {canManage && (
                                    <div className="flex justify-end gap-1.5">
                                        <EditButton onClick={() => open(unit)} />
                                        <RecordActions
                                            onDelete={() =>
                                                askDelete({
                                                    url: route('erp.inventory.units.destroy', unit.id),
                                                    title: `Delete ${unit.name}?`,
                                                    description: 'A unit used by any product or document cannot be deleted; mark it inactive instead.',
                                                })
                                            }
                                        />
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
            <FormDialog
                open={editing !== null}
                title={editing === 'new' ? 'New unit of measure' : `Edit ${editing?.name ?? ''}`}
                description={editing === 'new' ? undefined : 'The kind and conversion factor are fixed once a unit exists, so quantities already recorded stay correct.'}
                onClose={() => setEditing(null)}
                onSubmit={submit}
                processing={form.processing}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" error={form.errors.name}>
                        <TextInput value={form.data.name} onChange={(v) => form.setData('name', v)} placeholder="Each" required />
                    </Field>
                    <Field label="Abbreviation" error={form.errors.abbreviation}>
                        <TextInput value={form.data.abbreviation} onChange={(v) => form.setData('abbreviation', v)} placeholder="ea" required />
                    </Field>
                </div>
                {editing === 'new' ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Kind" error={form.errors.category}>
                                <Select value={form.data.category} onChange={(v) => form.setData('category', v)} options={unitCategories} />
                            </Field>
                            <Field label="Units in one base unit" error={form.errors.factor_to_base}>
                                <TextInput type="number" min="0" step="any" value={form.data.factor_to_base} onChange={(v) => form.setData('factor_to_base', v)} />
                            </Field>
                        </div>
                        <Checkbox label="This is the base unit for its kind" checked={form.data.is_base} onChange={(v) => form.setData('is_base', v)} />
                        {form.errors.is_base && <p className="text-destructive text-xs">{form.errors.is_base}</p>}
                    </>
                ) : (
                    <Checkbox label="Active" checked={form.data.is_active} onChange={(v) => form.setData('is_active', v)} />
                )}
            </FormDialog>
        </Card>
    );
}

/* ------------------------------------------------------ warehouses/locations */

function Warehouses({ warehouses, canManage, askDelete }: { warehouses: Warehouse[]; canManage: boolean; askDelete: AskDelete }) {
    const [warehouse, setWarehouse] = useState<Warehouse | 'new' | null>(null);
    const [location, setLocation] = useState<{ record: Location | null; warehouse: Warehouse } | null>(null);
    const warehouseForm = useForm({ code: '', name: '', address: '', is_active: true as boolean });
    const locationForm = useForm({ warehouse_id: '', parent_id: '', code: '', name: '', usage: 'internal', is_active: true as boolean });

    const openWarehouse = (record: Warehouse | 'new') => {
        warehouseForm.clearErrors();
        warehouseForm.setData(
            record === 'new' ? { code: '', name: '', address: '', is_active: true } : { code: record.code, name: record.name, address: record.address ?? '', is_active: record.is_active },
        );
        setWarehouse(record);
    };
    const openLocation = (target: Warehouse, record: Location | null) => {
        locationForm.clearErrors();
        locationForm.setData({
            warehouse_id: String(target.id),
            parent_id: record?.parent_id ? String(record.parent_id) : '',
            code: record?.code ?? '',
            name: record?.name ?? '',
            usage: record?.usage ?? 'internal',
            is_active: record?.is_active ?? true,
        });
        setLocation({ record, warehouse: target });
    };
    const submitWarehouse = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setWarehouse(null) };
        if (warehouse === 'new') warehouseForm.post(route('erp.inventory.warehouses.store'), options);
        else if (warehouse) warehouseForm.put(route('erp.inventory.warehouses.update', warehouse.id), options);
    };
    const submitLocation = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setLocation(null) };
        if (location?.record) locationForm.put(route('erp.inventory.locations.update', location.record.id), options);
        else if (location) locationForm.post(route('erp.inventory.locations.store'), options);
    };

    return (
        <Card title="Warehouses & stock locations" actions={canManage && <AddButton label="Add warehouse" onClick={() => openWarehouse('new')} />}>
            {warehouses.length === 0 ? (
                <Empty>No warehouses yet. Each new warehouse gets a "Stock" location to hold goods.</Empty>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {warehouses.map((item) => (
                        <div key={item.id} className="bg-muted/10 rounded-2xl border">
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                                        <WarehouseIcon className="size-5" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{item.name}</span>
                                            <span className="text-muted-foreground text-xs">{item.code}</span>
                                            <ActiveBadge active={item.is_active} />
                                        </div>
                                        {item.address && <div className="text-muted-foreground mt-0.5 text-xs">{item.address}</div>}
                                    </div>
                                </div>
                                {canManage && (
                                    <div className="flex gap-1.5">
                                        <ActionButton icon={Plus} label="Add location" tone="view" onClick={() => openLocation(item, null)} />
                                        <EditButton onClick={() => openWarehouse(item)} />
                                        <RecordActions
                                            onDelete={() =>
                                                askDelete({
                                                    url: route('erp.inventory.warehouses.destroy', item.id),
                                                    title: `Delete ${item.name}?`,
                                                    description: 'The warehouse and all its locations are removed. If stock has ever moved through it, it cannot be deleted; mark it inactive instead.',
                                                })
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                            {item.locations.length === 0 ? (
                                <p className="text-muted-foreground p-4 text-sm">No locations.</p>
                            ) : (
                                <ul className="divide-y">
                                    {item.locations.map((place) => (
                                        <li key={place.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <MapPin className="text-muted-foreground size-4 shrink-0" />
                                                <span className="truncate font-medium">{place.name}</span>
                                                <span className="text-muted-foreground text-xs">{place.code}</span>
                                                <span className="bg-muted rounded-full px-2 py-0.5 text-[11px]">{humanize(place.usage)}</span>
                                                {!place.is_active && <ActiveBadge active={false} />}
                                            </div>
                                            {canManage && (
                                                <div className="flex gap-1.5">
                                                    <EditButton onClick={() => openLocation(item, place)} />
                                                    <RecordActions
                                                        onDelete={() =>
                                                            askDelete({
                                                                url: route('erp.inventory.locations.destroy', place.id),
                                                                title: `Delete ${place.name}?`,
                                                                description: 'A location that stock has moved through cannot be deleted; mark it inactive instead.',
                                                            })
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <FormDialog
                open={warehouse !== null}
                title={warehouse === 'new' ? 'New warehouse' : `Edit ${warehouse?.name ?? ''}`}
                description={warehouse === 'new' ? 'A "Stock" location is created with it.' : undefined}
                onClose={() => setWarehouse(null)}
                onSubmit={submitWarehouse}
                processing={warehouseForm.processing}
            >
                <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                    <Field label="Code" error={warehouseForm.errors.code}>
                        <TextInput value={warehouseForm.data.code} onChange={(v) => warehouseForm.setData('code', v)} placeholder="MAIN" required />
                    </Field>
                    <Field label="Name" error={warehouseForm.errors.name}>
                        <TextInput value={warehouseForm.data.name} onChange={(v) => warehouseForm.setData('name', v)} required />
                    </Field>
                </div>
                <Field label="Address" error={warehouseForm.errors.address}>
                    <TextArea value={warehouseForm.data.address} onChange={(v) => warehouseForm.setData('address', v)} rows={2} />
                </Field>
                {warehouse !== 'new' && <Checkbox label="Active" checked={warehouseForm.data.is_active} onChange={(v) => warehouseForm.setData('is_active', v)} />}
            </FormDialog>

            <FormDialog
                open={location !== null}
                title={location?.record ? `Edit ${location.record.name}` : `New location in ${location?.warehouse.name ?? ''}`}
                onClose={() => setLocation(null)}
                onSubmit={submitLocation}
                processing={locationForm.processing}
            >
                <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                    <Field label="Code" error={locationForm.errors.code}>
                        <TextInput value={locationForm.data.code} onChange={(v) => locationForm.setData('code', v)} placeholder="SHELF-A" required />
                    </Field>
                    <Field label="Name" error={locationForm.errors.name}>
                        <TextInput value={locationForm.data.name} onChange={(v) => locationForm.setData('name', v)} required />
                    </Field>
                </div>
                <Field label="Type" error={locationForm.errors.usage}>
                    <Select value={locationForm.data.usage} onChange={(v) => locationForm.setData('usage', v)} options={locationUsages} />
                </Field>
                {!location?.record && (
                    <Field label="Inside" error={locationForm.errors.parent_id}>
                        <Select
                            value={locationForm.data.parent_id}
                            onChange={(v) => locationForm.setData('parent_id', v)}
                            options={(location?.warehouse.locations ?? []).map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))}
                            placeholder="Directly in the warehouse"
                        />
                    </Field>
                )}
                {location?.record && <Checkbox label="Active" checked={locationForm.data.is_active} onChange={(v) => locationForm.setData('is_active', v)} />}
            </FormDialog>
        </Card>
    );
}

