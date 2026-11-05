import { router, usePage } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { route } from 'ziggy-js';

type Company = {
    id: number;
    code: string;
    name: string;
};

type Props = {
    erpContext: {
        activeCompany: Company | null;
        companies: Company[];
    };
    canManageMembers: boolean;
    canManageRoles: boolean;
};

export default function Index({ erpContext, canManageMembers, canManageRoles }: Props) {
    const errors = (usePage().props as { errors?: Record<string, string> }).errors ?? {};
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [legalName, setLegalName] = useState('');

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.companies.store'), {
            code,
            name,
            legal_name: legalName || null,
        });
    };

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6">
            <section>
                <h1 className="text-2xl font-semibold">ERP companies</h1>
                <p className="text-muted-foreground mt-2 text-sm">Manage subsidiaries separately from existing project workspaces.</p>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Your companies</h2>
                {erpContext.companies.length === 0 && <p className="text-muted-foreground text-sm">You do not belong to an ERP company yet.</p>}
                <ul className="space-y-2">
                    {erpContext.companies.map((company) => (
                        <li key={company.id} className="flex items-center justify-between rounded-md border p-3">
                            <span>
                                <span className="font-medium">{company.name}</span>
                                <span className="text-muted-foreground ml-2 text-sm">{company.code}</span>
                            </span>
                            {erpContext.activeCompany?.id === company.id ? (
                                <span className="text-muted-foreground flex items-center gap-3 text-sm">
                                    Active
                                    {canManageMembers && (
                                        <a className="text-primary underline" href={route('erp.companies.members.index')}>
                                            Members
                                        </a>
                                    )}
                                    {canManageRoles && (
                                        <a className="text-primary underline" href={route('erp.settings.roles.index')}>
                                            Roles & access
                                        </a>
                                    )}
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    className="text-primary text-sm font-medium underline"
                                    onClick={() => router.post(route('erp.companies.switch', company.id))}
                                >
                                    Switch
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-medium">Create a company</h2>
                <form onSubmit={submit} className="grid gap-4">
                    <label className="grid gap-1 text-sm">
                        Company code
                        <input
                            required
                            maxLength={32}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.code && <span className="text-destructive text-sm">{errors.code}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Trading name
                        <input
                            required
                            maxLength={255}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.name && <span className="text-destructive text-sm">{errors.name}</span>}
                    </label>
                    <label className="grid gap-1 text-sm">
                        Legal name
                        <input
                            maxLength={255}
                            value={legalName}
                            onChange={(event) => setLegalName(event.target.value)}
                            className="bg-background rounded-md border px-3 py-2"
                        />
                        {errors.legal_name && <span className="text-destructive text-sm">{errors.legal_name}</span>}
                    </label>
                    <div>
                        <button type="submit" className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
                            Create company
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}
