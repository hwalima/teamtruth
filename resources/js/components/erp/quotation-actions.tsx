import { ActionButton, useConfirmDelete } from '@/components/erp/record-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { Ban, Copy, Eye, FileText, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { route } from 'ziggy-js';

type QuotationRef = {
    id: number;
    document_number: string;
    can_edit: boolean;
    can_cancel: boolean;
    can_delete: boolean;
};

/**
 * View, edit, PDF, duplicate, cancel and delete for one quotation.
 * Edit shows for drafts only; delete only for quotations with no approval or order history
 * (the others are cancelled and kept for the record).
 */
export function QuotationActions({
    quotation,
    canManage,
    showView = false,
    showPdf = true,
    showLabels = false,
}: {
    quotation: QuotationRef;
    canManage: boolean;
    showView?: boolean;
    showPdf?: boolean;
    showLabels?: boolean;
}) {
    const { askDelete, deleteDialog } = useConfirmDelete();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [busy, setBusy] = useState(false);

    const post = (url: string, after?: () => void) =>
        router.post(url, {}, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => (setBusy(false), after?.()) });

    return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
            {showView && <ActionButton icon={Eye} label="View" tone="view" href={route('erp.sales.quotations.show', quotation.id)} showLabel={showLabels} />}
            {canManage && quotation.can_edit && (
                <ActionButton icon={Pencil} label="Edit" tone="edit" href={route('erp.sales.quotations.edit', quotation.id)} showLabel={showLabels} />
            )}
            {showPdf && <ActionButton icon={FileText} label="PDF" href={route('erp.sales.quotations.pdf', quotation.id)} newTab showLabel={showLabels} />}
            {canManage && (
                <ActionButton
                    icon={Copy}
                    label="Duplicate"
                    disabled={busy}
                    onClick={() => post(route('erp.sales.quotations.duplicate', quotation.id))}
                    showLabel={showLabels}
                />
            )}
            {canManage && quotation.can_cancel && (
                <ActionButton icon={Ban} label="Cancel quotation" tone="delete" onClick={() => setConfirmCancel(true)} showLabel={showLabels} />
            )}
            {canManage && quotation.can_delete && (
                <ActionButton
                    icon={Trash2}
                    label="Delete"
                    tone="delete"
                    showLabel={showLabels}
                    onClick={() =>
                        askDelete({
                            url: route('erp.sales.quotations.destroy', quotation.id),
                            title: `Delete ${quotation.document_number}?`,
                            description: 'The quotation and its lines are removed. This cannot be undone.',
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
                        <DialogTitle>Cancel {quotation.document_number}?</DialogTitle>
                        <DialogDescription>
                            The quotation is kept for the record but can no longer be approved, sent or turned into a sales order. An approval that is still
                            waiting is withdrawn. You can duplicate it later to start again.
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
                            onClick={() => post(route('erp.sales.quotations.cancel', quotation.id), () => setConfirmCancel(false))}
                            disabled={busy}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                        >
                            <Ban className="size-4" />
                            {busy ? 'Cancelling…' : 'Cancel quotation'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
