import { router } from '@inertiajs/react';
import { Eye, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** View / edit / delete buttons for a record, and the confirmation before deleting. */

const tones = {
    view: 'text-sky-700 bg-sky-50 hover:bg-sky-100 ring-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:ring-sky-900',
    edit: 'text-amber-700 bg-amber-50 hover:bg-amber-100 ring-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:ring-amber-900',
    delete: 'text-rose-700 bg-rose-50 hover:bg-rose-100 ring-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:ring-rose-900',
    neutral: 'text-foreground bg-muted/50 hover:bg-muted ring-border',
} as const;

type Tone = keyof typeof tones;

export function ActionButton({
    icon: Icon,
    label,
    tone = 'neutral',
    href,
    onClick,
    showLabel = false,
    newTab = false,
    disabled = false,
}: {
    icon: LucideIcon;
    label: string;
    tone?: Tone;
    href?: string;
    onClick?: () => void;
    showLabel?: boolean;
    newTab?: boolean;
    disabled?: boolean;
}) {
    const className = `inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium ring-1 ring-inset transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 ${
        showLabel ? 'h-9 px-3' : 'size-8'
    } ${tones[tone]}`;
    const content = (
        <>
            <Icon className="size-4" aria-hidden />
            {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
        </>
    );

    return href ? (
        <a href={href} className={className} title={label} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {content}
        </a>
    ) : (
        <button type="button" onClick={onClick} className={`${className} disabled:pointer-events-none disabled:opacity-50`} title={label} disabled={disabled}>
            {content}
        </button>
    );
}

/** The usual trio. Leave out a link to hide its button. */
export function RecordActions({
    viewHref,
    editHref,
    onDelete,
    showLabels = false,
}: {
    viewHref?: string;
    editHref?: string;
    onDelete?: () => void;
    showLabels?: boolean;
}) {
    return (
        <div className="flex items-center justify-end gap-1.5">
            {viewHref && <ActionButton icon={Eye} label="View" tone="view" href={viewHref} showLabel={showLabels} />}
            {editHref && <ActionButton icon={Pencil} label="Edit" tone="edit" href={editHref} showLabel={showLabels} />}
            {onDelete && <ActionButton icon={Trash2} label="Delete" tone="delete" onClick={onDelete} showLabel={showLabels} />}
        </div>
    );
}

type PendingDelete = { url: string; title: string; description?: ReactNode };

/**
 * const { askDelete, deleteDialog } = useConfirmDelete();
 * <RecordActions onDelete={() => askDelete({ url, title: `Delete ${name}?` })} />
 * {deleteDialog}
 */
export function useConfirmDelete() {
    const [pending, setPending] = useState<PendingDelete | null>(null);
    const [busy, setBusy] = useState(false);

    const confirm = () => {
        if (!pending) return;
        router.delete(pending.url, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => {
                setBusy(false);
                setPending(null);
            },
        });
    };

    const deleteDialog = (
        <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
            <DialogContent>
                <DialogHeader>
                    <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        <Trash2 className="size-5" />
                    </div>
                    <DialogTitle>{pending?.title}</DialogTitle>
                    <DialogDescription>{pending?.description ?? 'This cannot be undone.'}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                    <button
                        type="button"
                        onClick={() => setPending(null)}
                        disabled={busy}
                        className="border-border hover:bg-muted inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirm}
                        disabled={busy}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                    >
                        <Trash2 className="size-4" />
                        {busy ? 'Deleting…' : 'Delete'}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { askDelete: setPending, deleteDialog };
}
