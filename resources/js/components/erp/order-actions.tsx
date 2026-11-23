import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { Ban, Eye, FileText, Send, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { route } from 'ziggy-js';

export type OrderFlags = {
    id: number;
    document_number: string;
    can_submit: boolean;
    can_deliver: boolean;
    can_invoice: boolean;
    can_cancel: boolean;
    can_delete: boolean;
};

/**
 * The buttons for one sales order. Deliver opens the order page at its delivery form;
 * invoicing bills what has gone out (and services) since the last invoice.
 */
export function OrderActions({
    order,
    canManage,
    showView = false,
    showDeliver = true,
    showLabels = false,
}: {
    order: OrderFlags;
    canManage: boolean;
    showView?: boolean;
    showDeliver?: boolean;
    showLabels?: boolean;
}) {
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [busy, setBusy] = useState(false);

    const post = (url: string, after?: () => void) =>
        router.post(url, {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => (setBusy(false), after?.()) });

    return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
            {showView && <ActionButton icon={Eye} label="View" tone="view" href={route('erp.sales.orders.show', order.id)} showLabel={showLabels} />}
            {canManage && order.can_submit && (
                <ActionButton
                    icon={Send}
                    label="Submit for approval"
                    tone="edit"
                    disabled={busy}
                    onClick={() => post(route('erp.sales.orders.submit', order.id))}
                    showLabel={showLabels}
                />
            )}
            {canManage && showDeliver && order.can_deliver && (
                <ActionButton icon={Truck} label="Deliver" tone="edit" href={`${route('erp.sales.orders.show', order.id)}#deliver`} showLabel={showLabels} />
            )}
            {canManage && order.can_invoice && (
                <ActionButton
                    icon={FileText}
                    label="Create invoice"
                    disabled={busy}
                    onClick={() => post(route('erp.sales.orders.invoice', order.id))}
                    showLabel={showLabels}
                />
            )}
            {canManage && order.can_cancel && (
                <ActionButton icon={Ban} label="Cancel order" tone="delete" onClick={() => setConfirmCancel(true)} showLabel={showLabels} />
            )}
            {canManage && order.can_delete && (
                <ActionButton
                    icon={Trash2}
                    label="Delete"
                    tone="delete"
                    showLabel={showLabels}
                    onClick={() =>
                        askDelete({
                            url: route('erp.sales.orders.destroy', order.id),
                            title: `Delete ${order.document_number}?`,
                            description: 'The order and its lines are removed. This cannot be undone.',
                        })
                    }
                />
            )}
            {deleteDialog}

            <Dialog open={confirmCancel} onOpenChange={(open) => !open && !busy && setConfirmCancel(false)}>
                <DialogContent>
                    <DialogHeader>
                        <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            <Ban className="size-5" />
                        </div>
                        <DialogTitle>Cancel {order.document_number}?</DialogTitle>
                        <DialogDescription>
                            The order is kept for the record but nothing more can be delivered or invoiced from it. An approval that is still waiting is
                            withdrawn.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <button
                            type="button"
                            onClick={() => setConfirmCancel(false)}
                            disabled={busy}
                            className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium"
                        >
                            Keep it
                        </button>
                        <button
                            type="button"
                            onClick={() => post(route('erp.sales.orders.cancel', order.id), () => setConfirmCancel(false))}
                            disabled={busy}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                        >
                            <Ban className="size-4" />
                            {busy ? 'Cancelling…' : 'Cancel order'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
