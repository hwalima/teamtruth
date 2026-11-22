import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Card, Checkbox, Empty, Field, Page, Pagination, Select, TextArea, TextInput, primaryButton, secondaryButton, type Paginated } from './ui';

export type FormValues = Record<string, string | number | boolean | null>;

export type SelectOption = { value: string | number; label: string };

export type FieldDef = {
    name: string;
    label: string;
    type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'color';
    options?: SelectOption[] | Record<string, string>;
    placeholder?: string;
    wide?: boolean;
    step?: string;
    /** Select without an empty choice. */
    required?: boolean;
};

export type ColumnDef<T> = { label: string; render: (record: T) => ReactNode };

type Props<T extends { id: number }> = {
    title: string;
    subtitle?: ReactNode;
    records: Paginated<T> | T[];
    columns: ColumnDef<T>[];
    fields: FieldDef[];
    defaults: FormValues;
    canManage: boolean;
    routes: { store: string; update: (id: number) => string; destroy?: (id: number) => string };
    search?: { value: string; url: string };
    noun?: string;
    /** Turn a record into form values when editing (defaults to copying field names). */
    toForm?: (record: T) => FormValues;
    extraActions?: (record: T) => ReactNode;
    headerActions?: ReactNode;
    children?: ReactNode;
};

/** A list with an inline create / edit form, used by the simple HRM setup screens. */
export default function CrudList<T extends { id: number }>(props: Props<T>) {
    const [editing, setEditing] = useState<T | null>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState(props.search?.value ?? '');
    const form = useForm<FormValues>({ ...props.defaults });
    const errors = form.errors as Record<string, string>;
    const rows = Array.isArray(props.records) ? props.records : props.records.data;
    const noun = props.noun ?? 'record';

    const startCreate = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...props.defaults });
        setOpen(true);
    };

    const startEdit = (record: T) => {
        setEditing(record);
        form.clearErrors();
        const values = props.toForm
            ? props.toForm(record)
            : Object.fromEntries(props.fields.map((f) => [f.name, (record as unknown as FormValues)[f.name] ?? props.defaults[f.name] ?? '']));
        form.setData(values);
        setOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setOpen(false) };
        if (editing) {
            form.put(props.routes.update(editing.id), options);
        } else {
            form.post(props.routes.store, options);
        }
    };

    const destroy = (record: T) => {
        if (props.routes.destroy && window.confirm(`Delete this ${noun}?`)) {
            router.delete(props.routes.destroy(record.id), { preserveScroll: true });
        }
    };

    const value = (name: string) => form.data[name] as string | number | null | undefined;

    const renderField = (field: FieldDef) => {
        const set = (v: string | number | boolean | null) => form.setData(field.name, v);
        switch (field.type) {
            case 'select':
                return <Select value={value(field.name)} onChange={set} options={field.options ?? []} placeholder={field.required ? undefined : (field.placeholder ?? '— None —')} />;
            case 'textarea':
                return <TextArea value={value(field.name) as string} onChange={set} />;
            case 'checkbox':
                return <Checkbox label={field.label} checked={Boolean(form.data[field.name])} onChange={set} />;
            case 'color':
                return <input type="color" value={(value(field.name) as string) || '#3b82f6'} onChange={(e) => set(e.target.value)} className="h-10 w-20 rounded border" />;
            default:
                return <TextInput type={field.type ?? 'text'} step={field.step} value={value(field.name)} onChange={set} placeholder={field.placeholder} />;
        }
    };

    return (
        <Page
            title={props.title}
            subtitle={props.subtitle}
            actions={
                <>
                    {props.headerActions}
                    {props.canManage && (
                        <button type="button" onClick={startCreate} className={primaryButton}>
                            Add {noun}
                        </button>
                    )}
                </>
            }
        >
            {open && (
                <Card title={editing ? `Edit ${noun}` : `New ${noun}`}>
                    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
                        {props.fields.map((field) =>
                            field.type === 'checkbox' ? (
                                <div key={field.name} className="flex items-end pb-2">
                                    {renderField(field)}
                                </div>
                            ) : (
                                <Field key={field.name} label={field.label} error={errors[field.name]} className={field.wide ? 'sm:col-span-3' : ''}>
                                    {renderField(field)}
                                </Field>
                            ),
                        )}
                        {errors.record && <p className="text-destructive text-sm sm:col-span-3">{errors.record}</p>}
                        <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" disabled={form.processing} className={primaryButton}>
                                Save
                            </button>
                            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            {props.children}

            {props.search && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get(props.search!.url, search ? { search } : {}, { preserveState: true });
                    }}
                    className="flex max-w-md gap-2"
                >
                    <TextInput value={search} onChange={setSearch} placeholder="Search name or code..." />
                    <button type="submit" className={secondaryButton}>
                        Search
                    </button>
                </form>
            )}

            {errors.record && !open && <p className="text-destructive text-sm">{errors.record}</p>}

            {rows.length === 0 ? (
                <Empty>Nothing here yet.{props.canManage && ` Use "Add ${noun}" to create the first one.`}</Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-left">
                            <tr>
                                {props.columns.map((column) => (
                                    <th key={column.label} className="px-4 py-3 font-medium">
                                        {column.label}
                                    </th>
                                ))}
                                {(props.canManage || props.extraActions) && <th className="px-4 py-3" />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((record) => (
                                <tr key={record.id} className="border-t align-top">
                                    {props.columns.map((column) => (
                                        <td key={column.label} className="px-4 py-3">
                                            {column.render(record)}
                                        </td>
                                    ))}
                                    {(props.canManage || props.extraActions) && (
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <span className="inline-flex gap-3">
                                                {props.extraActions?.(record)}
                                                {props.canManage && (
                                                    <button type="button" onClick={() => startEdit(record)} className="text-primary underline">
                                                        Edit
                                                    </button>
                                                )}
                                                {props.canManage && props.routes.destroy && (
                                                    <button type="button" onClick={() => destroy(record)} className="text-destructive underline">
                                                        Delete
                                                    </button>
                                                )}
                                            </span>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {!Array.isArray(props.records) && <Pagination page={props.records} />}
        </Page>
    );
}

