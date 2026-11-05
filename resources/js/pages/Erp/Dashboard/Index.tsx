import { Head, Link } from '@inertiajs/react';
import { ArrowUpRight, Boxes, BriefcaseBusiness, Building2, ClipboardList, Landmark, Settings2, ShoppingCart, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { route } from 'ziggy-js';

type Module = {
    key: string;
    name: string;
    description: string;
    href: string | null;
    available: boolean;
    status: 'available' | 'planned';
};
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    modules: Module[];
    canManageRoles: boolean;
    canManageMembers: boolean;
    summary: {
        members: number;
        products: number | null;
        vendors: number | null;
        accounts: number | null;
        journalEntries: number | null;
    };
};

const moduleIcons = {
    project_management: BriefcaseBusiness,
    requisitions: ClipboardList,
    inventory: Boxes,
    procurement: ShoppingCart,
    finance: Landmark,
    hrm: UsersRound,
} as const;

export default function Index({ company, modules, canManageRoles, canManageMembers, summary }: Props) {
    return (
        <main className="mx-auto w-full max-w-7xl space-y-8 p-5 sm:p-8">
            <Head title={`${company.name} | ERP`} />
            <section className="from-primary to-primary/80 text-primary-foreground relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-sm sm:p-9">
                <div className="bg-primary-foreground/5 absolute -top-20 -right-14 h-64 w-64 rounded-full" />
                <div className="relative flex flex-wrap items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                            <Building2 className="h-3.5 w-3.5" />
                            {company.code} · Enterprise workspace
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{company.name}</h1>
                        <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
                            Your company workspace. Open the modules you are responsible for, with access controlled by your company role.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canManageMembers && (
                            <Link
                                href={route('erp.companies.members.index')}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
                            >
                                <UsersRound className="h-4 w-4" /> Members
                            </Link>
                        )}
                        {canManageRoles && (
                            <Link
                                href={route('erp.settings.roles.index')}
                                className="text-primary inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white/90"
                            >
                                <Settings2 className="h-4 w-4" /> Roles & access
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <section aria-label="Company overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryCard label="Company members" value={summary.members} icon={<UsersRound className="h-4 w-4" />} />
                {summary.products !== null && (
                    <SummaryCard label="Inventory products" value={summary.products} icon={<Boxes className="h-4 w-4" />} />
                )}
                {summary.vendors !== null && (
                    <SummaryCard label="Active vendors" value={summary.vendors} icon={<ShoppingCart className="h-4 w-4" />} />
                )}
                {summary.accounts !== null && (
                    <SummaryCard label="Ledger accounts" value={summary.accounts} icon={<Landmark className="h-4 w-4" />} />
                )}
                {summary.journalEntries !== null && (
                    <SummaryCard label="Journal entries" value={summary.journalEntries} icon={<ClipboardList className="h-4 w-4" />} />
                )}
            </section>

            <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 className="text-xl font-semibold">Your modules</h2>
                        <p className="text-muted-foreground mt-1 text-sm">Available modules are based on your role in {company.name}.</p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {modules.map((module) => {
                        const Icon = moduleIcons[module.key as keyof typeof moduleIcons] ?? Building2;
                        const card = (
                            <div
                                className={`group bg-card flex h-full flex-col rounded-xl border p-5 shadow-sm transition ${module.available ? 'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md' : 'opacity-75'}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <span className="bg-primary/10 text-primary rounded-lg p-2.5">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    {module.available ? (
                                        <ArrowUpRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition" />
                                    ) : (
                                        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">Coming soon</span>
                                    )}
                                </div>
                                <h3 className="mt-4 font-semibold">{module.name}</h3>
                                <p className="text-muted-foreground mt-1 flex-1 text-sm leading-6">{module.description}</p>
                                {module.available && <span className="text-primary mt-4 text-sm font-medium">Open module</span>}
                            </div>
                        );

                        return module.available && module.href ? (
                            <Link key={module.key} href={module.href} className="block h-full">
                                {card}
                            </Link>
                        ) : (
                            <div key={module.key} aria-disabled="true">
                                {card}
                            </div>
                        );
                    })}
                    {modules.length === 0 && (
                        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm md:col-span-2 xl:col-span-3">
                            No modules are assigned to your role. Contact your company administrator.
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
    return (
        <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
            <span className="bg-muted text-muted-foreground rounded-lg p-2">{icon}</span>
            <div className="min-w-0">
                <p className="text-muted-foreground truncate text-xs">{label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
            </div>
        </div>
    );
}
