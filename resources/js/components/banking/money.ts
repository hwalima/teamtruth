/** Amounts arrive from the server as whole cents, so nothing is rounded on the way. */
export function money(cents: number | null | undefined): string {
    if (cents === null || cents === undefined) return '';
    const text = (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cents < 0 ? `-${text}` : text;
}

export function balanceClass(cents: number): string {
    return cents < 0 ? 'text-rose-600 dark:text-rose-400' : '';
}

export function shortDate(value: string | null | undefined): string {
    if (!value) return '—';
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}
