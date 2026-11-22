/** Shared labels and formatting for the Sales pages. */

export type QuotationStatus = 'draft' | 'pending_approval' | 'approved' | 'converted' | 'cancelled';

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Awaiting approval',
    approved: 'Approved',
    converted: 'Ordered',
    cancelled: 'Cancelled',
};

export const money = (currency: string, amount: string | number) =>
    `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
