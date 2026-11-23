import { useLiveSearch } from '@/hooks/use-live-search';
import { inputClass } from '@/components/hrm/ui';
import { router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Tab = { key: string; label: string; count?: number };

/**
 * Status tabs and a live search box for a list page. Changing either reloads the page
 * with ?status=…&search=…, leaving out the default status so the URL stays short.
 */
export function ListToolbar({
    url,
    filters,
    tabs,
    defaultStatus = 'all',
    placeholder,
    label,
}: {
    url: string;
    filters: { search: string; status: string };
    tabs: Tab[];
    defaultStatus?: string;
    placeholder: string;
    label: string;
}) {
    const [search, setSearch] = useState(filters.search);

    const go = (params: Partial<typeof filters>) => {
        const next = { ...filters, ...params };
        router.get(
            url,
            { ...(next.search ? { search: next.search } : {}), ...(next.status !== defaultStatus ? { status: next.status } : {}) },
            { preserveState: true, preserveScroll: true },
        );
    };

    useLiveSearch(search, () => go({ search: search.trim() }));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        go({ search: search.trim() });
    };

    return (
        <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div className="bg-muted/50 inline-flex rounded-xl p-1 whitespace-nowrap" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={filters.status === tab.key}
                            onClick={() => go({ status: tab.key })}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                filters.status === tab.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {tab.label} {tab.count !== undefined && <span className="text-muted-foreground tabular-nums">{tab.count}</span>}
                        </button>
                    ))}
                </div>
            </div>
            <form onSubmit={submit} className="flex w-full gap-2 sm:w-auto">
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
                    className={`${inputClass} min-w-0 flex-1 sm:w-72`}
                />
                <button
                    type="submit"
                    className="border-border/70 hover:bg-primary/10 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border"
                    aria-label="Search"
                    title="Search"
                >
                    <Search className="size-4" />
                </button>
            </form>
        </section>
    );
}
