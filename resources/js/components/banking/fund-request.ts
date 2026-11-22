export type Signer = { name: string; title: string | null; at: string | null; signature_url: string | null };

export type FundRequestRow = {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    purpose: string;
    status: 'pending' | 'approved' | 'rejected' | 'transferred' | 'cancelled';
    from: { company: string; company_id: number; account: string; account_id: number };
    to: { company: string; company_id: number; account: string; account_id: number };
    requester: Signer;
    approver: Signer | null;
    transferred_at: string | null;
    can_decide: boolean;
};

export const fundStatus: Record<string, { label: string; className: string; dot: string }> = {
    pending: {
        label: 'Awaiting approval',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    approved: {
        label: 'Approved · to transfer',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
        dot: 'bg-blue-500',
    },
    transferred: {
        label: 'Transferred',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
        dot: 'bg-emerald-500',
    },
    rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' },
    cancelled: { label: 'Withdrawn', className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-400' },
};

export function stamp(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
