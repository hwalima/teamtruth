/** Shared labels and formatting for the Sales pages. */

export type QuotationStatus = 'draft' | 'pending_approval' | 'approved' | 'converted' | 'cancelled';

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Awaiting approval',
    approved: 'Approved',
    converted: 'Ordered',
    cancelled: 'Cancelled',
};

export type OrderStatus = 'draft' | 'pending_approval' | 'approved' | 'partially_delivered' | 'delivered' | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Awaiting approval',
    approved: 'Approved',
    partially_delivered: 'Part delivered',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

/** Quantities without trailing zeros: 10.0000 → 10, 2.5000 → 2.5. */
export const qty = (value: string | number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });

export const money = (currency: string, amount: string | number) =>
    `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type LeadStatus = 'new' | 'qualified' | 'lost' | 'converted';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
    new: 'New',
    qualified: 'Qualified',
    lost: 'Lost',
    converted: 'Became opportunity',
};

export type OpportunityStatus = 'open' | 'won' | 'lost';

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
    open: 'Open',
    won: 'Won',
    lost: 'Lost',
};
