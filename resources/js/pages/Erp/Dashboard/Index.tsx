import { Head, Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Boxes,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    FileText,
    Landmark,
    Plus,
    Settings2,
    ShoppingCart,
    UsersRound,
    Wallet,
} from 'lucide-react';
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
type ApprovalItem = {
    id: number;
    type: string;
    reference: string;
    requester: string | null;
    amount: string | null;
    currency: string | null;
    submitted_at: string | null;
    href: string;
};
type RequisitionItem = { id: number; reference: string; status: string; amount: string | null; currency: string | null; href: string };
type MyWork = {
    approvals: { count: number; items: ApprovalItem[]; href: string } | null;
    requisitions: { open: number; items: RequisitionItem[]; href: string; create: string } | null;
    leave: { balances: Array<{ type: string; available: number }>; pending: number; href: string } | null;
};
type Tile = { key: string; group: string; label: string; value: string; hint: string | null; href: string; attention: boolean };
type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    userName: string;
    myWork: MyWork;
    tiles: Tile[];
    modules: Module[];
    canManageRoles: boolean;
    canManageMembers: boolean;
};

const moduleIcons = {
    project_management: BriefcaseBusiness,
    requisitions: ClipboardList,
    inventory: Boxes,
    procurement: ShoppingCart,
    finance: Landmark,
    invoicing: FileText,
    banking: Wallet,
    hrm: UsersRound,
} as const;

function greeting(): string {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function money(amount: string | null, currency: string | null): string | null {
    if (amount === null) return null;
    const value = Number(amount);
    return `${currency ?? ''} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`.trim();
}

const label = (status: string) => status.replaceAll('_', ' ');

export default function Index({ company, userName, myWork, tiles, modules, canManageRoles, canManageMembers }: Props) {
    const firstName = userName.split(' ')[0] || userName;
    const groups = tiles.reduce<Record<string, Tile[]>>((all, tile) => ({ ...all, [tile.group]: [...(all[tile.group] ?? []), tile] }), {});
    const hasWork = myWork.approvals !== null || myWork.requisitions !== null || myWork.leave !== null;

    return (
        <main className="mx-auto w-full max-w-7xl space-y-8 p-5 sm:p-8">
            <Head title={`${company.name} | Home`} />
            <section className="from-primary to-primary/80 text-primary-foreground relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-sm sm:p-8">
                <div className="bg-primary-foreground/5 absolute -top-20 -right-14 h-64 w-64 rounded-full" />
                <div className="relative flex flex-wrap items-end justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                            <Building2 className="h-3.5 w-3.5" />
                            {company.code} · {company.name}
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            {greeting()}, {firstName}
                        </h1>
                        <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
                            {myWork.approvals && myWork.approvals.count > 0
                                ? `${myWork.approvals.count} ${myWork.approvals.count === 1 ? 'document is' : 'documents are'} waiting for your approval.`
                                : 'Here is what needs your attention today.'}
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

            {hasWork && (
                <section aria-labelledby="my-work" className="space-y-4">
                    <h2 id="my-work" className="text-xl font-semibold">
                        My work
                    </h2>
                    <div className="grid gap-4 lg:grid-cols-3">
                        {myWork.approvals && (
                            <Panel
                                icon={<ClipboardCheck className="h-4 w-4" />}
                                title="Waiting for my approval"
                                count={myWork.approvals.count}
                                href={myWork.approvals.href}
                                linkLabel="Open approvals"
                            >
                                {myWork.approvals.items.length === 0 ? (
                                    <Empty icon={<CheckCircle2 className="h-5 w-5" />} text="Nothing waiting for you." />
                                ) : (
                                    <ul className="divide-y">
                                        {myWork.approvals.items.map((item) => (
                                            <li key={item.id}>
                                                <Link href={item.href} className="hover:bg-muted/60 -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5">
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium">
                                                            {item.type} {item.reference}
                                                        </span>
                                                        <span className="text-muted-foreground block truncate text-xs">
                                                            {item.requester ?? 'Unknown'}
                                                            {item.submitted_at && ` · ${new Date(item.submitted_at).toLocaleDateString()}`}
                                                        </span>
                                                    </span>
                                                    {item.amount !== null && (
                                                        <span className="shrink-0 text-sm tabular-nums">{money(item.amount, item.currency)}</span>
                                                    )}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Panel>
                        )}

                        {myWork.requisitions && (
                            <Panel
                                icon={<ClipboardList className="h-4 w-4" />}
                                title="My requisitions"
                                count={myWork.requisitions.open}
                                href={myWork.requisitions.href}
                                linkLabel="All requisitions"
                                action={
                                    <Link
                                        href={myWork.requisitions.create}
                                        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> New
                                    </Link>
                                }
                            >
                                {myWork.requisitions.items.length === 0 ? (
                                    <Empty icon={<ClipboardList className="h-5 w-5" />} text="You have no open requisitions." />
                                ) : (
                                    <ul className="divide-y">
                                        {myWork.requisitions.items.map((item) => (
                                            <li key={item.id}>
                                                <Link href={item.href} className="hover:bg-muted/60 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5">
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium">{item.reference}</span>
                                                        <span className="text-muted-foreground block text-xs capitalize">{label(item.status)}</span>
                                                    </span>
                                                    {item.amount !== null && (
                                                        <span className="shrink-0 text-sm tabular-nums">{money(item.amount, item.currency)}</span>
                                                    )}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Panel>
                        )}

                        {myWork.leave && (
                            <Panel
                                icon={<CalendarDays className="h-4 w-4" />}
                                title="My leave"
                                count={myWork.leave.pending}
                                countLabel="pending"
                                href={myWork.leave.href}
                                linkLabel="Self-service"
                            >
                                {myWork.leave.balances.length === 0 ? (
                                    <Empty icon={<CalendarDays className="h-5 w-5" />} text="No leave balances for this period yet." />
                                ) : (
                                    <ul className="divide-y">
                                        {myWork.leave.balances.map((balance) => (
                                            <li key={balance.type} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                                <span className="truncate">{balance.type}</span>
                                                <span className="font-medium tabular-nums">
                                                    {balance.available} {balance.available === 1 ? 'day' : 'days'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Panel>
                        )}
                    </div>
                </section>
            )}

            {Object.entries(groups).map(([group, groupTiles]) => (
                <section key={group} aria-label={group} className="space-y-3">
                    <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">{group}</h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {groupTiles.map((tile) => (
                            <Link
                                key={tile.key}
                                href={tile.href}
                                className={`group bg-card flex flex-col rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${tile.attention ? 'border-amber-300 dark:border-amber-700' : 'hover:border-primary/40'}`}
                            >
                                <span className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                                    {tile.label}
                                    <ArrowUpRight className="group-hover:text-primary h-3.5 w-3.5 shrink-0 transition" />
                                </span>
                                <span className="mt-1.5 text-2xl font-semibold break-words tabular-nums">{tile.value}</span>
                                {tile.hint && (
                                    <span className={`mt-1 text-xs ${tile.attention ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                        {tile.hint}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            ))}

            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">Your modules</h2>
                    <p className="text-muted-foreground mt-1 text-sm">Available modules are based on your role in {company.name}.</p>
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

function Panel({
    icon,
    title,
    count,
    countLabel,
    href,
    linkLabel,
    action,
    children,
}: {
    icon: ReactNode;
    title: string;
    count: number;
    countLabel?: string;
    href: string;
    linkLabel: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="bg-card flex min-w-0 flex-col rounded-xl border shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="bg-primary/10 text-primary rounded-md p-1.5">{icon}</span>
                    <span className="truncate">{title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    {action}
                    <span className="bg-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
                        {count}
                        {countLabel && ` ${countLabel}`}
                    </span>
                </span>
            </div>
            <div className="flex-1 px-4 py-1">{children}</div>
            <Link href={href} className="text-primary border-t px-4 py-2.5 text-sm font-medium hover:underline">
                {linkLabel}
            </Link>
        </div>
    );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-sm">
            {icon}
            {text}
        </div>
    );
}
