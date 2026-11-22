import { fundStatus, stamp } from '@/components/banking/fund-request';
import { money } from '@/components/banking/money';
import { Page, secondaryButton } from '@/components/hrm/ui';
import { Link } from '@inertiajs/react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, ShieldCheck, Table2, Wallet } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { route } from 'ziggy-js';

type Company = { id: number; code: string; name: string };
type Account = { id: number; account_number: string; account_name: string; company_id: number; currency: string; status: string; balance: number };
type SeriesRow = {
    company_id: number;
    currency: string;
    month: string;
    in: number;
    out: number;
    transfers_in: number;
    transfers_out: number;
    closing: number;
};
type TypeRow = { company_id: number; currency: string; month: string; type: string; debit: number; credit: number };
type Flow = { from_company_id: number; to_company_id: number; currency: string; month: string; amount: number; count: number };
type RecentRequest = {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    from: string;
    to: string;
    from_company_id: number;
    to_company_id: number;
    requested_at: string;
    requester: string;
    approver: string | null;
};

type Props = {
    companies: Company[];
    accounts: Account[];
    months: string[];
    series: SeriesRow[];
    types: TypeRow[];
    flows: Flow[];
    requests: {
        by_status: { status: string; currency: string; count: number; total: number }[];
        awaiting_me: number;
        recent: RecentRequest[];
    };
};

/** Validated categorical palette (fixed order, never cycled); companies past slot 8 share the neutral "other" ink. */
const SERIES = ['var(--bk-s1)', 'var(--bk-s2)', 'var(--bk-s3)', 'var(--bk-s4)', 'var(--bk-s5)', 'var(--bk-s6)', 'var(--bk-s7)', 'var(--bk-s8)'];
const OTHER = 'var(--bk-other)';
const PERIODS = [
    { value: 3, label: '3M' },
    { value: 6, label: '6M' },
    { value: 12, label: '12M' },
    { value: 24, label: '24M' },
    { value: 0, label: 'All' },
];

const palette = `
.bk-dash { --bk-s1:#2a78d6; --bk-s2:#eb6834; --bk-s3:#1baf7a; --bk-s4:#eda100; --bk-s5:#e87ba4; --bk-s6:#008300; --bk-s7:#6250d6; --bk-s8:#e34948;
  --bk-other:#898781; --bk-grid:#e1e0d9; --bk-axis:#898781; --bk-surface:#fcfcfb; --bk-in:#2a78d6; --bk-out:#eb6834; }
.dark .bk-dash { --bk-s1:#3987e5; --bk-s2:#d95926; --bk-s3:#199e70; --bk-s4:#c98500; --bk-s5:#d55181; --bk-s6:#0ca30c; --bk-s7:#9085e9; --bk-s8:#e66767;
  --bk-grid:#2c2c2a; --bk-surface:#1a1a19; --bk-in:#3987e5; --bk-out:#d95926; }
`;

const monthLabel = (month: string) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};
const compact = (cents: number) => {
    const value = cents / 100;
    const abs = Math.abs(value);
    const text = abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k` : abs.toFixed(0);
    return value < 0 ? `-${text}` : text;
};

export default function BankingDashboard({ companies, accounts, months, series, types, flows, requests }: Props) {
    const currencies = useMemo(() => {
        const totals = new Map<string, number>();
        accounts.forEach((a) => totals.set(a.currency, (totals.get(a.currency) ?? 0) + 1));
        return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    }, [accounts]);
    const [currency, setCurrency] = useState(currencies[0] ?? 'USD');
    const [period, setPeriod] = useState(12);
    const [hidden, setHidden] = useState<Set<number>>(new Set());
    const [stacked, setStacked] = useState(true);
    const [showTable, setShowTable] = useState(false);

    // Colour follows the company, never its rank: fixed by position in the full list.
    const colorOf = useMemo(() => {
        const map = new Map<number, string>();
        companies.forEach((c, i) => map.set(c.id, SERIES[i] ?? OTHER));
        return (id: number) => map.get(id) ?? OTHER;
    }, [companies]);
    const nameOf = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);

    const inCurrency = useMemo(
        () => companies.filter((c) => accounts.some((a) => a.company_id === c.id && a.currency === currency)),
        [companies, accounts, currency],
    );
    const visible = inCurrency.filter((c) => !hidden.has(c.id));
    const visibleIds = new Set(visible.map((c) => c.id));
    const span = period === 0 ? months : months.slice(-period);
    const windowSet = new Set(span);
    const rows = series.filter((r) => r.currency === currency && visibleIds.has(r.company_id) && windowSet.has(r.month));

    const toggle = (id: number) =>
        setHidden((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else if (inCurrency.length - next.size > 1) next.add(id);
            return next;
        });

    // Balance trend: month-end balance, per company.
    const trend = span.map((month) => {
        const point: Record<string, number | string> = { month, label: monthLabel(month) };
        let total = 0;
        visible.forEach((c) => {
            const value = series.find((r) => r.month === month && r.company_id === c.id && r.currency === currency)?.closing ?? 0;
            point[`c${c.id}`] = value / 100;
            total += value;
        });
        point.total = total / 100;
        return point;
    });

    const flowByMonth = span.map((month) => {
        const monthRows = rows.filter((r) => r.month === month);
        return {
            month,
            label: monthLabel(month),
            in: monthRows.reduce((n, r) => n + r.in, 0) / 100,
            out: monthRows.reduce((n, r) => n + r.out, 0) / 100,
        };
    });

    const balances = visible
        .map((c) => ({
            id: c.id,
            name: c.name,
            value: accounts.filter((a) => a.company_id === c.id && a.currency === currency).reduce((n, a) => n + a.balance, 0),
        }))
        .sort((a, b) => b.value - a.value);
    const totalBalance = balances.reduce((n, b) => n + b.value, 0);
    const moneyIn = rows.reduce((n, r) => n + r.in, 0);
    const moneyOut = rows.reduce((n, r) => n + r.out, 0);
    const transfersIn = rows.reduce((n, r) => n + r.transfers_in, 0);

    const spending = Object.values(
        types
            .filter((t) => t.currency === currency && visibleIds.has(t.company_id) && windowSet.has(t.month) && t.debit > 0)
            .reduce<Record<string, { type: string; value: number }>>((acc, t) => {
                acc[t.type] ??= { type: t.type, value: 0 };
                acc[t.type].value += t.debit;
                return acc;
            }, {}),
    )
        .sort((a, b) => b.value - a.value)
        .slice(0, 7)
        .map((t) => ({ ...t, amount: t.value / 100 }));

    const pairs = Object.values(
        flows
            .filter(
                (f) => f.currency === currency && windowSet.has(f.month) && (visibleIds.has(f.from_company_id) || visibleIds.has(f.to_company_id)),
            )
            .reduce<Record<string, { from: number; to: number; amount: number; count: number }>>((acc, f) => {
                const key = `${f.from_company_id}-${f.to_company_id}`;
                acc[key] ??= { from: f.from_company_id, to: f.to_company_id, amount: 0, count: 0 };
                acc[key].amount += f.amount;
                acc[key].count += f.count;
                return acc;
            }, {}),
    ).sort((a, b) => b.amount - a.amount);
    const maxPair = Math.max(1, ...pairs.map((p) => p.amount));

    const pending = requests.by_status.filter((s) => s.status === 'pending' && s.currency === currency);
    const pendingCount = requests.by_status.filter((s) => s.status === 'pending').reduce((n, s) => n + s.count, 0);
    const recent = requests.recent.filter((r) => visibleIds.has(r.from_company_id) || visibleIds.has(r.to_company_id));
    const periodText = period === 0 ? 'all time' : `last ${period} months`;

    if (accounts.length === 0) {
        return (
            <Page title="Banking dashboard">
                <div className="text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
                    No bank accounts yet. Import statements or open an account under{' '}
                    <a className="text-primary font-medium" href={route('erp.banking.index')}>
                        Accounts & Statements
                    </a>
                    .
                </div>
            </Page>
        );
    }

    return (
        <Page
            title="Banking dashboard"
            subtitle={`${visible.length} of ${inCurrency.length} compan${inCurrency.length === 1 ? 'y' : 'ies'} Â· ${currency} Â· ${periodText}`}
            actions={
                <>
                    <a href={route('erp.banking.fund-requests.index')} className={secondaryButton}>
                        <ShieldCheck className="mr-1.5 size-4" /> Fund requests
                        {requests.awaiting_me > 0 && (
                            <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{requests.awaiting_me}</span>
                        )}
                    </a>
                    <a href={route('erp.banking.index')} className={secondaryButton}>
                        <Landmark className="mr-1.5 size-4" /> Accounts
                    </a>
                </>
            }
        >
            <style>{palette}</style>
            <div className="bk-dash space-y-6">
                {/* Filters: one row above every chart */}
                <div className="bg-card/70 flex flex-wrap items-center gap-3 rounded-xl border p-3">
                    <div className="bg-muted/60 inline-flex rounded-lg p-1" role="group" aria-label="Period">
                        {PERIODS.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setPeriod(p.value)}
                                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${period === p.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {currencies.length > 1 && (
                        <select
                            value={currency}
                            onChange={(e) => {
                                setCurrency(e.target.value);
                                setHidden(new Set());
                            }}
                            className="bg-background h-9 rounded-lg border px-2 text-sm"
                            aria-label="Currency"
                        >
                            {currencies.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        {inCurrency.map((c) => {
                            const off = hidden.has(c.id);
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggle(c.id)}
                                    aria-pressed={!off}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${off ? 'text-muted-foreground opacity-50' : 'bg-background'}`}
                                >
                                    <span className="size-2.5 rounded-full" style={{ background: colorOf(c.id) }} />
                                    {c.name}
                                </button>
                            );
                        })}
                    </div>
                    {hidden.size > 0 && (
                        <button type="button" className="text-primary text-xs font-medium" onClick={() => setHidden(new Set())}>
                            Show all
                        </button>
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Kpi
                        icon={<Wallet className="size-4" />}
                        label="Balance today"
                        value={`${currency} ${money(totalBalance)}`}
                        note={`${accounts.filter((a) => a.currency === currency && visibleIds.has(a.company_id)).length} accounts`}
                    />
                    <Kpi
                        icon={<ArrowDownLeft className="size-4" />}
                        label="Money in"
                        value={`${currency} ${money(moneyIn)}`}
                        note={`${periodText}, excluding transfers`}
                    />
                    <Kpi
                        icon={<ArrowUpRight className="size-4" />}
                        label="Money out"
                        value={`${currency} ${money(moneyOut)}`}
                        note={`Net ${moneyIn - moneyOut < 0 ? '' : '+'}${money(moneyIn - moneyOut)}`}
                    />
                    <Link href={route('erp.banking.fund-requests.index', { status: 'pending' })} className="block">
                        <Kpi
                            icon={<ShieldCheck className="size-4" />}
                            label="Awaiting approval"
                            value={String(pendingCount)}
                            note={
                                pending.length > 0
                                    ? `${currency} ${money(pending.reduce((n, p) => n + p.total, 0))} requested Â· ${requests.awaiting_me} need you`
                                    : `Transfers in: ${currency} ${money(transfersIn)}`
                            }
                            highlight={requests.awaiting_me > 0}
                        />
                    </Link>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <Panel
                        className="xl:col-span-2"
                        title="Balance over time"
                        subtitle="Month-end balance"
                        actions={
                            <div className="bg-muted/60 inline-flex rounded-lg p-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setStacked(true)}
                                    className={`rounded-md px-2.5 py-1 font-semibold ${stacked ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    By company
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStacked(false)}
                                    className={`rounded-md px-2.5 py-1 font-semibold ${!stacked ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Total
                                </button>
                            </div>
                        }
                    >
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    {visible.map((c) => (
                                        <linearGradient key={c.id} id={`bk-g${c.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={colorOf(c.id)} stopOpacity={0.45} />
                                            <stop offset="100%" stopColor={colorOf(c.id)} stopOpacity={0.08} />
                                        </linearGradient>
                                    ))}
                                    <linearGradient id="bk-gtotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--bk-s1)" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="var(--bk-s1)" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} stroke="var(--bk-grid)" />
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: 'var(--bk-axis)', fontSize: 11 }}
                                    minTickGap={16}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: 'var(--bk-axis)', fontSize: 11 }}
                                    tickFormatter={(v) => compact(v * 100)}
                                    width={48}
                                />
                                <Tooltip
                                    content={<ChartTooltip currency={currency} names={nameOf} showTotal={stacked} />}
                                    cursor={{ stroke: 'var(--bk-axis)', strokeDasharray: '3 3' }}
                                />
                                {stacked ? (
                                    visible.map((c) => (
                                        <Area
                                            key={c.id}
                                            type="monotone"
                                            dataKey={`c${c.id}`}
                                            name={c.name}
                                            stackId="b"
                                            stroke={colorOf(c.id)}
                                            strokeWidth={2}
                                            fill={`url(#bk-g${c.id})`}
                                            activeDot={{ r: 4, stroke: 'var(--bk-surface)', strokeWidth: 2 }}
                                        />
                                    ))
                                ) : (
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        name="All selected"
                                        stroke="var(--bk-s1)"
                                        strokeWidth={2}
                                        fill="url(#bk-gtotal)"
                                        activeDot={{ r: 4, stroke: 'var(--bk-surface)', strokeWidth: 2 }}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                        <Legend
                            items={
                                stacked
                                    ? visible.map((c) => ({ label: c.name, color: colorOf(c.id) }))
                                    : [{ label: 'All selected companies', color: 'var(--bk-s1)' }]
                            }
                        />
                    </Panel>

                    <Panel title="Balance by company" subtitle="Today Â· click a company to hide it">
                        <div className="relative">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={balances.filter((b) => b.value > 0)}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={64}
                                        outerRadius={96}
                                        paddingAngle={2}
                                        stroke="var(--bk-surface)"
                                        strokeWidth={2}
                                        onClick={(entry: { id?: number }) => entry?.id && toggle(entry.id)}
                                        className="cursor-pointer"
                                    >
                                        {balances
                                            .filter((b) => b.value > 0)
                                            .map((b) => (
                                                <Cell key={b.id} fill={colorOf(b.id)} />
                                            ))}
                                    </Pie>
                                    <Tooltip
                                        content={({ active, payload }) =>
                                            active && payload?.[0] ? (
                                                <TooltipBox>
                                                    <div className="font-semibold">{payload[0].name}</div>
                                                    <div className="tabular-nums">
                                                        {currency} {money(Number(payload[0].value))}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        {totalBalance > 0 ? Math.round((Number(payload[0].value) / totalBalance) * 100) : 0}% of the
                                                        total
                                                    </div>
                                                </TooltipBox>
                                            ) : null
                                        }
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-muted-foreground text-[11px] tracking-wide uppercase">Total</span>
                                <span className="text-lg font-semibold tabular-nums">{compact(totalBalance)}</span>
                            </div>
                        </div>
                        <ul className="space-y-1.5 text-sm">
                            {balances.map((b) => (
                                <li key={b.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(b.id)}
                                        className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left"
                                    >
                                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(b.id) }} />
                                        <span className="min-w-0 flex-1 truncate">{b.name}</span>
                                        <span className={`font-medium tabular-nums ${b.value < 0 ? 'text-rose-600' : ''}`}>{money(b.value)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <Panel
                        className="xl:col-span-2"
                        title="Money in and out"
                        subtitle="Per month, excluding transfers between accounts"
                        actions={
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
                                onClick={() => setShowTable((v) => !v)}
                            >
                                <Table2 className="size-3.5" /> {showTable ? 'Chart' : 'Table'}
                            </button>
                        }
                    >
                        {showTable ? (
                            <div className="max-h-[300px] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-card sticky top-0">
                                        <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                                            <th className="py-2 font-medium">Month</th>
                                            <th className="py-2 text-right font-medium">In</th>
                                            <th className="py-2 text-right font-medium">Out</th>
                                            <th className="py-2 text-right font-medium">Net</th>
                                            <th className="py-2 text-right font-medium">Month-end balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {flowByMonth.map((m, i) => (
                                            <tr key={m.month} className="border-b last:border-0">
                                                <td className="py-1.5">{m.label}</td>
                                                <td className="py-1.5 text-right tabular-nums">{money(Math.round(m.in * 100))}</td>
                                                <td className="py-1.5 text-right tabular-nums">{money(Math.round(m.out * 100))}</td>
                                                <td className="py-1.5 text-right tabular-nums">{money(Math.round((m.in - m.out) * 100))}</td>
                                                <td className="py-1.5 text-right tabular-nums">{money(Math.round(Number(trend[i].total) * 100))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={flowByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                                        <CartesianGrid vertical={false} stroke="var(--bk-grid)" />
                                        <XAxis
                                            dataKey="label"
                                            tickLine={false}
                                            axisLine={{ stroke: 'var(--bk-grid)' }}
                                            tick={{ fill: 'var(--bk-axis)', fontSize: 11 }}
                                            minTickGap={12}
                                        />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: 'var(--bk-axis)', fontSize: 11 }}
                                            tickFormatter={(v) => compact(v * 100)}
                                            width={48}
                                        />
                                        <Tooltip
                                            content={<ChartTooltip currency={currency} showNet />}
                                            cursor={{ fill: 'var(--bk-grid)', opacity: 0.5 }}
                                        />
                                        <Bar dataKey="in" name="Money in" fill="var(--bk-in)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                        <Bar dataKey="out" name="Money out" fill="var(--bk-out)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                                <Legend
                                    items={[
                                        { label: 'Money in', color: 'var(--bk-in)' },
                                        { label: 'Money out', color: 'var(--bk-out)' },
                                    ]}
                                />
                            </>
                        )}
                    </Panel>

                    <Panel title="Where money goes" subtitle={`Debits by transaction type Â· ${periodText}`}>
                        {spending.length === 0 ? (
                            <EmptyChart>No debits in this period.</EmptyChart>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(160, spending.length * 38)}>
                                <BarChart data={spending} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="28%">
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="type"
                                        tickLine={false}
                                        axisLine={false}
                                        width={96}
                                        tick={{ fill: 'var(--bk-axis)', fontSize: 11 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'var(--bk-grid)', opacity: 0.5 }}
                                        content={({ active, payload }) =>
                                            active && payload?.[0] ? (
                                                <TooltipBox>
                                                    <div className="font-semibold">{String(payload[0].payload.type)}</div>
                                                    <div className="tabular-nums">
                                                        {currency} {money(payload[0].payload.value)}
                                                    </div>
                                                </TooltipBox>
                                            ) : null
                                        }
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="var(--bk-out)"
                                        radius={[0, 4, 4, 0]}
                                        maxBarSize={18}
                                        label={{
                                            position: 'right',
                                            fontSize: 11,
                                            fill: 'var(--bk-axis)',
                                            formatter: (v: ReactNode) => compact(Number(v) * 100),
                                        }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Panel>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title="Transfers between companies" subtitle={periodText}>
                        {pairs.length === 0 ? (
                            <EmptyChart>No money moved between companies in this period.</EmptyChart>
                        ) : (
                            <ul className="space-y-3">
                                {pairs.slice(0, 8).map((p) => (
                                    <li key={`${p.from}-${p.to}`} className="group">
                                        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                                            <span className="flex min-w-0 items-center gap-1.5 font-medium">
                                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(p.from) }} />
                                                <span className="truncate">{nameOf.get(p.from)}</span>
                                                <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                                                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(p.to) }} />
                                                <span className="truncate">{nameOf.get(p.to) ?? 'Other company'}</span>
                                            </span>
                                            <span className="shrink-0 tabular-nums">
                                                {money(p.amount)} <span className="text-muted-foreground text-xs">Â· {p.count}Ã—</span>
                                            </span>
                                        </div>
                                        <div className="bg-muted h-2 overflow-hidden rounded-full">
                                            <div
                                                className="h-full rounded-full transition-all group-hover:opacity-80"
                                                style={{ width: `${(p.amount / maxPair) * 100}%`, background: colorOf(p.from) }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel
                        title="Latest fund requests"
                        subtitle="Who asked, who approved"
                        actions={
                            <Link href={route('erp.banking.fund-requests.index')} className="text-primary text-xs font-medium">
                                Open register
                            </Link>
                        }
                    >
                        {recent.length === 0 ? (
                            <EmptyChart>No fund requests yet.</EmptyChart>
                        ) : (
                            <ul className="divide-y">
                                {recent.map((r) => (
                                    <li key={r.id}>
                                        <Link
                                            href={route('erp.banking.fund-requests.show', r.id)}
                                            className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5"
                                        >
                                            <span className={`size-2 shrink-0 rounded-full ${fundStatus[r.status]?.dot}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 text-sm font-medium">
                                                    <span className="truncate">{r.from}</span>
                                                    <ArrowRight className="text-muted-foreground size-3 shrink-0" />
                                                    <span className="truncate">{r.to}</span>
                                                </div>
                                                <div className="text-muted-foreground truncate text-xs">
                                                    {r.reference} Â· {r.requester}
                                                    {r.approver ? ` â†’ ${r.approver}` : ''} Â· {stamp(r.requested_at)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold tabular-nums">
                                                    {r.currency} {money(r.amount)}
                                                </div>
                                                <div className="text-muted-foreground text-xs">{fundStatus[r.status]?.label}</div>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </Page>
    );
}

function Kpi({ icon, label, value, note, highlight = false }: { icon: ReactNode; label: string; value: string; note: string; highlight?: boolean }) {
    return (
        <div className={`bg-card/70 h-full rounded-xl border p-4 transition hover:shadow-sm ${highlight ? 'border-amber-400/70' : ''}`}>
            <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <span className="bg-muted text-foreground flex size-7 items-center justify-center rounded-lg">{icon}</span>
                {label}
            </div>
            <div className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
            <div className="text-muted-foreground mt-1 truncate text-xs">{note}</div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    actions,
    children,
    className = '',
}: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={`bg-card/70 space-y-4 rounded-xl border p-4 sm:p-5 ${className}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="font-semibold">{title}</h2>
                    {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {items.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                    {item.label}
                </span>
            ))}
        </div>
    );
}

function EmptyChart({ children }: { children: ReactNode }) {
    return <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">{children}</div>;
}

function TooltipBox({ children }: { children: ReactNode }) {
    return <div className="bg-popover text-popover-foreground space-y-0.5 rounded-lg border px-3 py-2 text-xs shadow-lg">{children}</div>;
}

type TipItem = { value?: number | string; name?: string; color?: string; dataKey?: string | number };
type TipProps = { active?: boolean; payload?: TipItem[]; label?: ReactNode };

function ChartTooltip({
    active,
    payload,
    label,
    currency,
    showTotal = false,
    showNet = false,
}: TipProps & { currency: string; names?: Map<number, string>; showTotal?: boolean; showNet?: boolean }) {
    if (!active || !payload?.length) return null;
    const items = payload.filter((p) => p.value !== undefined);
    const sum = items.reduce((n, p) => n + Number(p.value ?? 0), 0);
    const net = showNet ? Number(items.find((p) => p.dataKey === 'in')?.value ?? 0) - Number(items.find((p) => p.dataKey === 'out')?.value ?? 0) : 0;
    return (
        <TooltipBox>
            <div className="mb-1 font-semibold">{label}</div>
            {[...items].reverse().map((p) => (
                <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: p.color }} />
                        {p.name}
                    </span>
                    <span className="tabular-nums">{money(Math.round(Number(p.value) * 100))}</span>
                </div>
            ))}
            {showTotal && items.length > 1 && (
                <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">
                        {currency} {money(Math.round(sum * 100))}
                    </span>
                </div>
            )}
            {showNet && (
                <div className="mt-1 flex justify-between gap-4 border-t pt-1 font-semibold">
                    <span>Net</span>
                    <span className="tabular-nums">{money(Math.round(net * 100))}</span>
                </div>
            )}
        </TooltipBox>
    );
}
