import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { route } from 'ziggy-js';

type UserOption = { id: number; name: string; email: string };
type ErpRole = { id: number; name: string; slug: string };
type Member = UserOption & { role: string; erp_role_id: number | null; erp_role_name: string | null; is_active: boolean };
type Props = {
    company: { id: number; code: string; name: string };
    members: Member[];
    eligibleUsers: UserOption[];
    roles: ErpRole[];
};

export default function Members({ company, members, eligibleUsers, roles }: Props) {
    const form = useForm({
        user_id: eligibleUsers[0]?.id.toString() ?? '',
        role_id: (roles.find((role) => role.slug === 'member') ?? roles.find((role) => role.slug !== 'owner'))?.id.toString() ?? '',
    });
    const errors = form.errors as Record<string, string>;
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post(route('erp.companies.members.store'));
    };

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-6">
            <header>
                <p className="text-muted-foreground text-sm">{company.code}</p>
                <h1 className="text-2xl font-semibold">{company.name} members</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Assign each member a company-specific ERP role. Their access updates for this company without changing their access elsewhere.
                </p>
            </header>

            <section className="space-y-3 rounded-md border p-4">
                <h2 className="text-lg font-medium">Add or reactivate a member</h2>
                {eligibleUsers.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        There are no unassigned staff accounts. Create the employee account in the app’s user management area first.
                    </p>
                ) : (
                    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="grid gap-1 text-sm">
                            Employee
                            <select
                                required
                                value={form.data.user_id}
                                onChange={(event) => form.setData('user_id', event.target.value)}
                                className="bg-background rounded-md border px-3 py-2"
                            >
                                {eligibleUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} — {user.email}
                                    </option>
                                ))}
                            </select>
                            {errors.user_id && <span className="text-destructive">{errors.user_id}</span>}
                        </label>
                        <label className="grid gap-1 text-sm">
                            Company role
                            <select
                                required
                                value={form.data.role_id}
                                onChange={(event) => form.setData('role_id', event.target.value)}
                                className="bg-background rounded-md border px-3 py-2"
                            >
                                {roles
                                    .filter((role) => role.slug !== 'owner')
                                    .map((role) => (
                                        <option key={role.id} value={role.id}>
                                            {role.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <button
                            type="submit"
                            disabled={form.processing || !form.data.user_id || !form.data.role_id}
                            className="bg-primary text-primary-foreground self-end rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                            Save member
                        </button>
                    </form>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Company users</h2>
                <ul className="space-y-2">
                    {members.map((member) => (
                        <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                            <span>
                                <span className="font-medium">{member.name}</span>
                                <span className="text-muted-foreground ml-2 text-sm">{member.email}</span>
                                <span className="ml-2 rounded border px-2 py-0.5 text-xs">{member.erp_role_name ?? member.role}</span>
                                {!member.is_active && <span className="text-destructive ml-2 text-xs">Inactive</span>}
                            </span>
                            {member.role !== 'owner' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        aria-label={`Role for ${member.name}`}
                                        value={member.erp_role_id?.toString() ?? ''}
                                        onChange={(event) => {
                                            if (event.target.value) {
                                                router.patch(route('erp.companies.members.role.update', member.id), { role_id: event.target.value });
                                            }
                                        }}
                                        className="bg-background rounded-md border px-2 py-1 text-sm"
                                    >
                                        {roles
                                            .filter((role) => role.slug !== 'owner')
                                            .map((role) => (
                                                <option key={role.id} value={role.id}>
                                                    {role.name}
                                                </option>
                                            ))}
                                    </select>
                                    {member.is_active && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm(`Deactivate ${member.name} in this ERP company?`)) {
                                                    router.delete(route('erp.companies.members.deactivate', member.id));
                                                }
                                            }}
                                            className="text-destructive text-sm underline"
                                        >
                                            Deactivate
                                        </button>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <a href={route('erp.dashboard')} className="text-primary inline-block text-sm underline">
                Back to ERP dashboard
            </a>
        </main>
    );
}
