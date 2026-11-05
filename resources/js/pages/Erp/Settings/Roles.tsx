import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type Role = {
    id: number;
    name: string;
    slug: string;
    permissions: string[];
    is_system: boolean;
    members_count: number;
};
type Props = {
    company: { id: number; code: string; name: string };
    roles: Role[];
    permissionGroups: Record<string, Record<string, string>>;
};

export default function Roles({ company, roles, permissionGroups }: Props) {
    const groups = Object.entries(permissionGroups);

    return (
        <main className="mx-auto max-w-6xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">ERP roles & permissions</h1>
                <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
                    Create company-specific roles and choose exactly which ERP modules each role can use. Changes apply to all members assigned to
                    that role. The company owner always retains full access.
                </p>
            </header>

            <CreateRole groups={filterAdminPermissions(groups)} />

            <section className="space-y-4">
                <h2 className="text-lg font-medium">Company roles</h2>
                {roles.map((role) => (
                    <RoleEditor key={role.id} role={role} groups={groups} />
                ))}
            </section>
        </main>
    );
}

function CreateRole({ groups }: { groups: Array<[string, Record<string, string>]> }) {
    const editableGroups = filterAdminPermissions(groups);
    const form = useForm<{ name: string; permissions: string[] }>({ name: '', permissions: [] });
    const errors = form.errors as Record<string, string>;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.settings.roles.store'), { preserveScroll: true, onSuccess: () => form.reset() });
    };

    return (
        <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
            <div>
                <h2 className="font-medium">Create a role</h2>
                <p className="text-muted-foreground text-sm">For example: HR Officer, Storekeeper, or Finance Manager.</p>
            </div>
            <label className="grid max-w-md gap-1 text-sm">
                Role name
                <input
                    value={form.data.name}
                    onChange={(event) => form.setData('name', event.target.value)}
                    required
                    maxLength={80}
                    className="bg-background rounded-md border px-3 py-2"
                />
                {errors.name && <span className="text-destructive">{errors.name}</span>}
            </label>
            <PermissionGroups
                groups={editableGroups}
                permissions={form.data.permissions}
                onChange={(permissions) => form.setData('permissions', permissions)}
            />
            {errors.permissions && <p className="text-destructive text-sm">{errors.permissions}</p>}
            <button
                type="submit"
                disabled={form.processing || !form.data.name.trim()}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
                Create role
            </button>
        </form>
    );
}

function RoleEditor({ role, groups }: { role: Role; groups: Array<[string, Record<string, string>]> }) {
    const editableGroups = role.slug === 'admin' ? groups : filterAdminPermissions(groups);
    const initialPermissions = role.permissions.includes('*')
        ? editableGroups.flatMap(([, permissions]) => Object.keys(permissions))
        : role.permissions.filter((permission) => editableGroups.some(([, items]) => permission in items));
    const form = useForm<{ name: string; permissions: string[] }>({ name: role.name, permissions: initialPermissions });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.patch(route('erp.settings.roles.update', role.id), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-medium">{role.name}</h3>
                    <p className="text-muted-foreground text-sm">
                        {role.members_count} {role.members_count === 1 ? 'member' : 'members'} · {role.is_system ? 'Built-in role' : 'Custom role'}
                    </p>
                </div>
                {role.slug === 'owner' && <span className="rounded-full border px-2 py-1 text-xs">Full access</span>}
            </div>
            {role.slug !== 'owner' && (
                <>
                    <label className="grid max-w-md gap-1 text-sm">
                        Display name
                        <input
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            required
                            maxLength={80}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                    </label>
                    <PermissionGroups
                        groups={groups}
                        permissions={form.data.permissions}
                        onChange={(permissions) => form.setData('permissions', permissions)}
                    />
                    {Object.entries(form.errors).map(([field, error]) => (
                        <p key={field} className="text-destructive text-sm">
                            {error}
                        </p>
                    ))}
                    <button type="submit" disabled={form.processing} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">
                        Save {role.name}
                    </button>
                </>
            )}
        </form>
    );
}

function filterAdminPermissions(groups: Array<[string, Record<string, string>]>): Array<[string, Record<string, string>]> {
    const privileged = new Set(['erp.companies.manage', 'erp.members.manage', 'erp.roles.manage']);
    return groups
        .map(
            ([group, permissions]) =>
                [group, Object.fromEntries(Object.entries(permissions).filter(([key]) => !privileged.has(key)))] as [string, Record<string, string>],
        )
        .filter(([, permissions]) => Object.keys(permissions).length > 0);
}

function PermissionGroups({
    groups,
    permissions,
    onChange,
}: {
    groups: Array<[string, Record<string, string>]>;
    permissions: string[];
    onChange: (permissions: string[]) => void;
}) {
    const toggle = (permission: string) => {
        onChange(permissions.includes(permission) ? permissions.filter((item) => item !== permission) : [...permissions, permission]);
    };

    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(([group, items]) => (
                <fieldset key={group} className="bg-muted/30 space-y-2 rounded-md p-3">
                    <legend className="font-medium">{group}</legend>
                    {Object.entries(items).map(([key, label]) => (
                        <label key={key} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" checked={permissions.includes(key)} onChange={() => toggle(key)} className="mt-1" />
                            <span>{label}</span>
                        </label>
                    ))}
                </fieldset>
            ))}
        </div>
    );
}
