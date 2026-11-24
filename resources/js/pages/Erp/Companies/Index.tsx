import { Head, router, usePage } from '@inertiajs/react';
import { ArrowRight, Building2, Plus, Settings2, UsersRound } from 'lucide-react';
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
    roles: Record<number, string>;
    canCreate: boolean;
    canManageMembers: boolean;
    canManageRoles: boolean;
};

export default function Index({ erpContext, roles, canCreate, canManageMembers, canManageRoles }: Props) {
    const errors = (usePage().props as { errors?: Record<string, string> }).errors ?? {};
    const [creating, setCreating] = useState(Object.keys(errors).length > 0);
    const [opening, setOpening] = useState<number | null>(null);
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [legalName, setLegalName] = useState('');
    const { companies, activeCompany } = erpContext;
    const choosing = activeCompany === null && companies.length > 1;

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post(route('erp.companies.store'), {
            code,
            name,
            legal_name: legalName || null,
        });
    };

    const open = (company: Company) => {
        setOpening(company.id);
        router.post(route('erp.companies.switch', company.id), {}, { onFinish: () => setOpening(null) });
    };

    return (
        <main className="mx-auto w-full max-w-4xl space-y-8 p-5 sm:p-8">
            <Head title={choosing ? 'Choose a company' : 'Companies'} />
            <section>
                <h1 className="text-2xl font-semibold sm:text-3xl">{choosing ? 'Choose a company to work in' : 'Your companies'}</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {choosing
                        ? `You belong to ${companies.length} companies. We will remember your choice next time you sign in, and you can switch at any time from here.`
                        : companies.length === 0
                          ? 'You do not belong to an ERP company yet. Ask your company administrator to add you.'
                          : 'Open a company to work in it. Your role decides what you can see and do in each one.'}
                </p>
            </section>

            {companies.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2">
                    {companies.map((company) => {
                        const isActive = activeCompany?.id === company.id;
                        return (
                            <li
                                key={company.id}
                                className={`bg-card flex flex-col rounded-xl border p-5 shadow-sm ${isActive ? 'border-primary/50 ring-primary/20 ring-2' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="bg-primary/10 text-primary shrink-0 rounded-lg p-2.5">
                                        <Building2 className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold">{company.name}</h2>
                                        <p className="text-muted-foreground text-xs">{company.code}</p>
                                    </div>
                                    {isActive && <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">Current</span>}
                                </div>
                                {roles[company.id] && (
                                    <p className="text-muted-foreground mt-4 text-sm">
                                        Your role: <span className="text-foreground font-medium">{roles[company.id]}</span>
                                    </p>
                                )}
                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={opening !== null}
                                        onClick={() => open(company)}
                                        className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-60"
                                    >
                                        {opening === company.id ? 'Opening…' : 'Open'}
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                    {isActive && canManageMembers && (
                                        <a className="text-primary inline-flex items-center gap-1 text-sm hover:underline" href={route('erp.companies.members.index')}>
                                            <UsersRound className="h-4 w-4" /> Members
                                        </a>
                                    )}
                                    {isActive && canManageRoles && (
                                        <a className="text-primary inline-flex items-center gap-1 text-sm hover:underline" href={route('erp.settings.roles.index')}>
                                            <Settings2 className="h-4 w-4" /> Roles & access
                                        </a>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {canCreate && (
                <section className="bg-card rounded-xl border p-5">
                    {!creating ? (
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline"
                        >
                            <Plus className="h-4 w-4" /> Add a new company
                        </button>
                    ) : (
                        <form onSubmit={submit} className="grid gap-4">
                            <h2 className="font-semibold">Add a new company</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
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
                            </div>
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
                            <div className="flex gap-2">
                                <button type="submit" className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">
                                    Create company
                                </button>
                                <button type="button" onClick={() => setCreating(false)} className="rounded-md border px-4 py-2 text-sm">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            )}
        </main>
    );
}
