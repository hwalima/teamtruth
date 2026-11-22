import { Link, router } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react';
import { Fragment, useState } from 'react';
import { route } from 'ziggy-js';

type ReportKey = 'balance-sheet' | 'aged-receivables' | 'aged-payables';
type Line = { accountId: number | null; code: string; name: string; amount: string };
type BalanceSheet = {
    asOf: string;
    yearStart: string;
    assets: Line[];
    liabilities: Line[];
    equity: Line[];
    totalAssets: string;
    totalLiabilities: string;
    totalEquity: string;
    totalLiabilitiesAndEquity: string;
    difference: string;
};
type BucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'over_90';
type AgedDocument = { id: number; number: string; date: string; dueDate: string | null; daysOverdue: number; bucket: BucketKey; outstanding: string };
type AgedPartner = Record<BucketKey, string> & {
    partnerId: number;
    partner: string;
    currency: string;
    credits: string;
    total: string;
    documents: AgedDocument[];
};
type AgedTotal = Record<BucketKey, string> & { currency: string; credits: string; total: string; partners: number };
type Aged = { asOf: string; buckets: Record<BucketKey, string>; partners: AgedPartner[]; totals: AgedTotal[] };

type Props = {
    company: { id: number; code: string; name: string; default_currency: string };
    report: ReportKey;
    asOf: string;
    data: BalanceSheet | Aged;
};

const tabs: { key: ReportKey; label: string; hint: string }[] = [
    { key: 'balance-sheet', label: 'Balance sheet', hint: 'What the company owns and owes on a date, from the posted ledger.' },
    { key: 'aged-receivables', label: 'Aged receivables', hint: 'What customers owed on a date, grouped by how long it has been overdue.' },
    { key: 'aged-payables', label: 'Aged payables', hint: 'What was owed to vendors on a date, grouped by how long it has been overdue.' },
];

const inputClass =
    'border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 rounded-xl border px-3 py-2 text-sm shadow-sm transition outline-none focus:ring-4';
const card = 'bg-card/70 overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,26,77,0.06)]';

/** 1234.5 → "1,234.50"; negatives in brackets, as accountants write them. */
function money(value: string | number, blankZero = false) {
    const amount = Number(value);
    if (blankZero && amount === 0) return '';
    const text = Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return amount < 0 ? `(${text})` : text;
}

function longDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FinancialReports({ company, report, asOf, data }: Props) {
    const go = (params: { report?: ReportKey; as_of?: string }) =>
        router.get(route('erp.accounting.financial-reports.index'), { report, as_of: asOf, ...params }, { preserveState: true, preserveScroll: true, replace: true });

    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const quickDates = [
        { label: 'Today', value: iso(today) },
        { label: 'End of last month', value: iso(new Date(today.getFullYear(), today.getMonth(), 0)) },
        { label: 'End of last year', value: iso(new Date(today.getFullYear() - 1, 11, 31)) },
    ];
    const tab = tabs.find((item) => item.key === report) ?? tabs[0];

    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        <Link href={route('erp.accounting.index')} className="hover:underline">
                            Finance & Accounting
                        </Link>{' '}
                        · {company.name}
                    </p>
                    <h1 className="text-2xl font-semibold">Financial reports</h1>
                    <p className="text-muted-foreground mt-1 text-sm">{tab.hint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['pdf', 'csv'] as const).map((format) => (
                        <a
                            key={format}
                            href={route('erp.accounting.financial-reports.export', { report, format, as_of: asOf })}
                            className="border-border/70 bg-background/40 hover:bg-primary/10 inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors"
                        >
                            {format === 'pdf' ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4" />}
                            {format === 'pdf' ? 'Export PDF' : 'Export CSV'}
                        </a>
                    ))}
                </div>
            </header>

            <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="bg-muted/50 inline-flex flex-wrap rounded-xl p-1" role="tablist">
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={report === item.key}
                            onClick={() => go({ report: item.key })}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                report === item.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-muted-foreground text-sm" htmlFor="as-of">
                        As at
                    </label>
                    <input id="as-of" type="date" value={asOf} onChange={(e) => e.target.value && go({ as_of: e.target.value })} className={inputClass} />
                    {quickDates.map((quick) => (
                        <button
                            key={quick.label}
                            type="button"
                            onClick={() => go({ as_of: quick.value })}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                asOf === quick.value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 hover:bg-muted'
                            }`}
                        >
                            {quick.label}
                        </button>
                    ))}
                </div>
            </section>

            {report === 'balance-sheet' ? (
                <BalanceSheetView data={data as BalanceSheet} currency={company.default_currency} />
            ) : (
                <AgedView data={data as Aged} kind={report === 'aged-payables' ? 'vendor' : 'customer'} />
            )}
        </main>
    );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
    return (
        <div className={`rounded-xl border p-4 ${tone === 'warn' ? 'border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'bg-card/70'}`}>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}

function BalanceSheetView({ data, currency }: { data: BalanceSheet; currency: string }) {
    const balanced = Number(data.difference) === 0;
    const sections: [string, Line[], string, string][] = [
        ['Assets', data.assets, data.totalAssets, 'Total assets'],
        ['Liabilities', data.liabilities, data.totalLiabilities, 'Total liabilities'],
        ['Equity', data.equity, data.totalEquity, 'Total equity'],
    ];

    return (
        <>
            <section className="grid gap-3 sm:grid-cols-3">
                <Stat label={`Assets (${currency})`} value={money(data.totalAssets)} />
                <Stat label={`Liabilities (${currency})`} value={money(data.totalLiabilities)} />
                <Stat label={`Equity (${currency})`} value={money(data.totalEquity)} />
            </section>

            {!balanced && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Assets and liabilities plus equity differ by {currency} {money(data.difference)}. This usually means opening balances have not been entered yet.
                </div>
            )}

            <section className={card}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                        <tbody>
                            {sections.map(([title, lines, total, totalLabel]) => (
                                <Fragment key={title}>
                                    <tr className="bg-muted/40">
                                        <th colSpan={3} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide uppercase">
                                            {title}
                                        </th>
                                    </tr>
                                    {lines.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="text-muted-foreground px-4 py-3">
                                                Nothing recorded.
                                            </td>
                                        </tr>
                                    )}
                                    {lines.map((line) => (
                                        <tr key={`${title}-${line.accountId ?? line.name}`} className="border-t">
                                            <td className="text-muted-foreground w-28 px-4 py-2 tabular-nums">{line.code}</td>
                                            <td className={`px-4 py-2 ${line.accountId === null ? 'italic' : ''}`}>{line.name}</td>
                                            <td className="px-4 py-2 text-right tabular-nums">{money(line.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t font-semibold">
                                        <td />
                                        <td className="px-4 py-2">{totalLabel}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{money(total)}</td>
                                    </tr>
                                </Fragment>
                            ))}
                            <tr className="border-foreground/70 border-t-2 border-b-4 border-double text-base font-semibold">
                                <td />
                                <td className="px-4 py-3">Total liabilities and equity</td>
                                <td className="px-4 py-3 text-right tabular-nums">{money(data.totalLiabilitiesAndEquity)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
            <p className="text-muted-foreground text-xs">
                In {currency}, from posted journal entries up to {longDate(data.asOf)}. Profit since {longDate(data.yearStart)} is shown under equity until the year
                is closed.
            </p>
        </>
    );
}

function AgedView({ data, kind }: { data: Aged; kind: 'customer' | 'vendor' }) {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const bucketKeys = Object.keys(data.buckets) as BucketKey[];
    const label = kind === 'vendor' ? 'Vendor' : 'Customer';
    const showCredits = data.partners.some((partner) => Number(partner.credits) !== 0);

    return (
        <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.totals.length === 0 && <Stat label="Outstanding" value="0.00" />}
                {data.totals.map((total) => (
                    <Fragment key={total.currency}>
                        <Stat label={`Outstanding (${total.currency})`} value={money(total.total)} />
                        <Stat
                            label={`Over 90 days (${total.currency})`}
                            value={money(total.over_90)}
                            tone={Number(total.over_90) > 0 ? 'warn' : 'default'}
                        />
                    </Fragment>
                ))}
            </section>

            <section className={card}>
                {data.partners.length === 0 ? (
                    <div className="text-muted-foreground px-4 py-12 text-center text-sm">Nothing was outstanding on {longDate(data.asOf)}.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-sm">
                            <thead className="bg-muted/40 text-muted-foreground text-left text-xs tracking-wide uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-medium">{label}</th>
                                    {bucketKeys.map((key) => (
                                        <th key={key} className="px-3 py-3 text-right font-medium">
                                            {data.buckets[key]}
                                        </th>
                                    ))}
                                    {showCredits && <th className="px-3 py-3 text-right font-medium">Unused credits</th>}
                                    <th className="px-4 py-3 text-right font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {data.partners.map((partner) => {
                                    const key = `${partner.partnerId}-${partner.currency}`;
                                    const expanded = open[key];
                                    return (
                                        <Fragment key={key}>
                                            <tr className="hover:bg-muted/30">
                                                <td className="px-4 py-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpen((state) => ({ ...state, [key]: !state[key] }))}
                                                        className="inline-flex items-center gap-1.5 text-left font-medium"
                                                        aria-expanded={!!expanded}
                                                        disabled={partner.documents.length === 0}
                                                    >
                                                        {partner.documents.length > 0 &&
                                                            (expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />)}
                                                        {partner.partner}
                                                    </button>
                                                    <div className="text-muted-foreground pl-5.5 text-xs">
                                                        {partner.currency} · {partner.documents.length} open
                                                    </div>
                                                </td>
                                                {bucketKeys.map((bucket) => (
                                                    <td
                                                        key={bucket}
                                                        className={`px-3 py-2.5 text-right tabular-nums ${
                                                            bucket !== 'current' && Number(partner[bucket]) > 0 ? 'text-red-600 dark:text-red-400' : ''
                                                        }`}
                                                    >
                                                        {money(partner[bucket], true)}
                                                    </td>
                                                ))}
                                                {showCredits && <td className="px-3 py-2.5 text-right tabular-nums">{money(partner.credits, true)}</td>}
                                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(partner.total)}</td>
                                            </tr>
                                            {expanded &&
                                                partner.documents.map((document) => (
                                                    <tr key={document.id} className="bg-muted/20 text-xs">
                                                        <td className="py-2 pr-4 pl-10">
                                                            {kind === 'customer' ? (
                                                                <Link href={route('erp.invoicing.show', document.id)} className="font-medium hover:underline">
                                                                    {document.number}
                                                                </Link>
                                                            ) : (
                                                                <span className="font-medium">{document.number}</span>
                                                            )}
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                · {longDate(document.date)}
                                                                {document.dueDate ? ` · due ${longDate(document.dueDate)}` : ''}
                                                                {document.daysOverdue > 0 ? ` · ${document.daysOverdue} days overdue` : ''}
                                                            </span>
                                                        </td>
                                                        {bucketKeys.map((bucket) => (
                                                            <td key={bucket} className="px-3 py-2 text-right tabular-nums">
                                                                {document.bucket === bucket ? money(document.outstanding) : ''}
                                                            </td>
                                                        ))}
                                                        {showCredits && <td />}
                                                        <td />
                                                    </tr>
                                                ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t-2 font-semibold">
                                {data.totals.map((total) => (
                                    <tr key={total.currency}>
                                        <td className="px-4 py-3">
                                            Total {total.currency}{' '}
                                            <span className="text-muted-foreground text-xs font-normal">
                                                ({total.partners} {total.partners === 1 ? label.toLowerCase() : `${label.toLowerCase()}s`})
                                            </span>
                                        </td>
                                        {bucketKeys.map((bucket) => (
                                            <td key={bucket} className="px-3 py-3 text-right tabular-nums">
                                                {money(total[bucket], true)}
                                            </td>
                                        ))}
                                        {showCredits && <td className="px-3 py-3 text-right tabular-nums">{money(total.credits, true)}</td>}
                                        <td className="px-4 py-3 text-right tabular-nums">{money(total.total)}</td>
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                    </div>
                )}
            </section>
            <p className="text-muted-foreground text-xs">
                {kind === 'customer'
                    ? 'Issued invoices less payments and credit notes applied on or before the date. Days overdue count from the due date.'
                    : 'Approved vendor bills less posted payments made on or before the date. Days overdue count from the due date.'}
            </p>
        </>
    );
}
