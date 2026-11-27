import type { ReactNode } from 'react';

/** Small shared building blocks for the HRM pages. */

export type Options = Record<string, string>;
export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    links?: { url: string | null; label: string; active: boolean }[];
};

export const inputClass =
    'border-input bg-background/70 text-foreground focus:border-primary/60 focus:ring-primary/10 min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-sm shadow-sm transition outline-none focus:ring-4';
export const primaryButton =
    'bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60';
export const secondaryButton =
    'border-border/70 bg-background/40 hover:bg-primary/10 hover:border-primary/30 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';
export const dangerButton =
    'border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
    return (
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">{title}</h1>
                    {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </header>
            {children}
        </main>
    );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`bg-card/70 space-y-5 rounded-2xl border p-4 sm:p-6 ${className}`}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {title && (
                        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                            <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#f0c766] to-[#cf9c33]" />
                            {title}
                        </h2>
                    )}
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/**
 * Navy "aurora" banner for the top of a home or overview page. Pass stats for the
 * glass tiles along the bottom and actions for the buttons on the right.
 */
export function Hero({
    eyebrow,
    title,
    highlight,
    subtitle,
    actions,
    stats,
    as: Tag = 'section',
}: {
    eyebrow?: ReactNode;
    title: ReactNode;
    highlight?: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    stats?: { icon?: ReactNode; label: string; value: ReactNode; href?: string }[];
    as?: 'section' | 'header';
}) {
    return (
        <Tag className="erp-hero p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-2xl min-w-0">
                    {eyebrow && (
                        <div className="erp-hero-chip mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-white/85">{eyebrow}</div>
                    )}
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        {title}
                        {highlight && (
                            <>
                                {' '}
                                <span className="erp-hero-shimmer">{highlight}</span>
                            </>
                        )}
                    </h1>
                    {subtitle && <div className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">{subtitle}</div>}
                </div>
                {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
            {stats && stats.length > 0 && (
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.map((stat) => {
                        const body = (
                            <>
                                {stat.icon && (
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#E3B448]">{stat.icon}</span>
                                )}
                                <span className="min-w-0">
                                    <span className="block truncate text-xs text-white/60">{stat.label}</span>
                                    <span className="block text-2xl font-semibold text-white tabular-nums">{stat.value}</span>
                                </span>
                            </>
                        );
                        return stat.href ? (
                            <a key={stat.label} href={stat.href} className="erp-hero-stat flex items-center gap-3 rounded-2xl px-4 py-3">
                                {body}
                            </a>
                        ) : (
                            <div key={stat.label} className="erp-hero-stat flex items-center gap-3 rounded-2xl px-4 py-3">
                                {body}
                            </div>
                        );
                    })}
                </div>
            )}
        </Tag>
    );
}

/** Classes for buttons that sit on a Hero banner. */
export const heroButton =
    'inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-[#E3B448]/60 hover:bg-white/15';
export const heroButtonSolid =
    'inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-[#f0c766] to-[#cf9c33] px-4 py-2 text-sm font-semibold text-[#001a4d] shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5';

export function Field({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) {
    return (
        <label className={`grid content-start gap-1.5 text-sm ${className}`}>
            <span className="text-foreground/85 font-medium">{label}</span>
            {children}
            {error && <span className="text-destructive text-xs">{error}</span>}
        </label>
    );
}

export function TextInput({
    value,
    onChange,
    type = 'text',
    ...rest
}: { value: string | number | null | undefined; onChange: (value: string) => void; type?: string; placeholder?: string; min?: string | number; max?: string | number; step?: string; required?: boolean }) {
    return <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest} />;
}

export function TextArea({ value, onChange, rows = 3 }: { value: string | null | undefined; onChange: (value: string) => void; rows?: number }) {
    return <textarea value={value ?? ''} rows={rows} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
}

export function Select({
    value,
    onChange,
    options,
    placeholder,
}: {
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    options: Options | { value: string | number; label: string }[];
    placeholder?: string;
}) {
    const list = Array.isArray(options) ? options : Object.entries(options).map(([value, label]) => ({ value, label }));

    return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {list.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 cursor-pointer rounded" />
            <span>{label}</span>
        </label>
    );
}

const badgeColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    inactive: 'bg-gray-100 text-gray-800',
    draft: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-800',
    terminated: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
    submitted: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-yellow-100 text-yellow-800',
    in_approval: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    on_leave: 'bg-yellow-100 text-yellow-800',
    probation: 'bg-blue-100 text-blue-800',
    open: 'bg-blue-100 text-blue-800',
    renewed: 'bg-blue-100 text-blue-800',
};

export function StatusBadge({ value, label }: { value: string | null | undefined; label?: string }) {
    if (!value) return null;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-black/5 ring-inset ${badgeColors[value] ?? 'bg-blue-100 text-blue-800'}`}
        >
            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
            {label ?? humanize(value)}
        </span>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return (
        <div className="border-border/80 bg-muted/20 text-muted-foreground relative overflow-hidden rounded-2xl border border-dashed px-4 py-12 text-center text-sm leading-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-32 w-64 rounded-full bg-[#E3B448]/10 blur-3xl" />
            <div className="relative">{children}</div>
        </div>
    );
}

export function Pagination<T>({ page }: { page: Paginated<T> }) {
    if (page.last_page <= 1 || !page.links) return null;
    return (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
            {page.links.map((link, index) =>
                link.url ? (
                    <a
                        key={index}
                        href={link.url}
                        className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-sm transition ${link.active ? 'border-transparent bg-gradient-to-br from-[#f0c766] to-[#cf9c33] font-semibold text-[#001a4d] shadow-md shadow-amber-500/20' : 'bg-card/70 hover:border-primary/40 hover:bg-primary/10'}`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span key={index} className="text-muted-foreground px-2 text-sm" dangerouslySetInnerHTML={{ __html: link.label }} />
                ),
            )}
        </nav>
    );
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
            <dd className="mt-0.5 text-sm">{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
    );
}

export function humanize(value: string | null | undefined): string {
    if (!value) return '';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function toDateInput(value: string | null | undefined): string {
    return value ? value.slice(0, 10) : '';
}

export function personName(person: { first_name?: string; middle_name?: string | null; last_name?: string } | null | undefined): string {
    if (!person) return '—';
    return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
}

export function idOptions<T extends { id: number }>(items: T[], label: (item: T) => string) {
    return items.map((item) => ({ value: item.id, label: label(item) }));
}

/** Turn '' into null so optional ids and dates validate on the server. */
export function blanksToNull<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])) as T;
}
