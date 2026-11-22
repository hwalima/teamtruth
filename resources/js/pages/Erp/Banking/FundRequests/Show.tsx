import { fundStatus, stamp, type FundRequestRow, type Signer } from '@/components/banking/fund-request';
import { money, shortDate } from '@/components/banking/money';
import { SignaturePad } from '@/components/banking/signature-pad';
import { Card, Field, Page, TextArea, TextInput, dangerButton, primaryButton, secondaryButton } from '@/components/hrm/ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router, useForm } from '@inertiajs/react';
import { AlertTriangle, ArrowRight, Ban, Banknote, CheckCircle2, Clock, FileDown, PenLine, Send, XCircle } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { route } from 'ziggy-js';

type Detail = FundRequestRow & {
    from_bank: string;
    to_bank: string;
    from_balance: number;
    decision_note: string | null;
    cancelled_at: string | null;
    transferred_by: string | null;
    transfer_date: string | null;
    transfer_reference: string | null;
    can_cancel: boolean;
    can_execute: boolean;
};

export default function FundRequestShow({
    request,
    approvers,
    savedSignatureUrl,
}: {
    request: Detail;
    approvers: string[];
    savedSignatureUrl: string | null;
}) {
    const status = fundStatus[request.status];
    const [rejectOpen, setRejectOpen] = useState(false);
    const short = request.status === 'pending' || request.status === 'approved' ? request.from_balance < request.amount : false;

    return (
        <Page
            title={`Fund request ${request.reference}`}
            subtitle={<span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>}
            actions={
                <>
                    <a href={route('erp.banking.fund-requests.index')} className={secondaryButton}>
                        All fund requests
                    </a>
                    <a href={route('erp.banking.fund-requests.pdf', request.id)} className={secondaryButton}>
                        <FileDown className="mr-1.5 size-4" /> PDF
                    </a>
                    {request.can_cancel && (
                        <button
                            type="button"
                            className={dangerButton}
                            onClick={() =>
                                confirm('Withdraw this request? The approver will no longer be able to act on it.') &&
                                router.post(route('erp.banking.fund-requests.cancel', request.id), {}, { preserveScroll: true })
                            }
                        >
                            <Ban className="mr-1.5 size-4" /> Withdraw
                        </button>
                    )}
                </>
            }
        >
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <div className="space-y-6">
                    <section className="from-primary/10 via-card to-card overflow-hidden rounded-2xl border bg-gradient-to-br p-6">
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Amount requested</div>
                        <div className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                            <span className="text-muted-foreground mr-2 text-xl">{request.currency}</span>
                            {money(request.amount)}
                        </div>
                        <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
                            <Party label="Pay from" company={request.from.company} account={request.from.account} bank={request.from_bank} />
                            <div className="bg-primary text-primary-foreground hidden size-10 items-center justify-center rounded-full shadow sm:flex">
                                <ArrowRight className="size-5" />
                            </div>
                            <Party label="Pay to" company={request.to.company} account={request.to.account} bank={request.to_bank} />
                        </div>
                        <div className="text-muted-foreground mt-4 text-xs">
                            Balance in {request.from.account} today:{' '}
                            <span className={`font-semibold tabular-nums ${short ? 'text-rose-600' : 'text-foreground'}`}>
                                {request.currency} {money(request.from_balance)}
                            </span>
                        </div>
                        {short && (
                            <div className="mt-3 flex gap-2 rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> The paying account holds less than the amount requested.
                            </div>
                        )}
                    </section>

                    <Card title="Purpose">
                        <p className="text-sm leading-6 whitespace-pre-line">{request.purpose}</p>
                        {request.decision_note && (
                            <div className="bg-muted/40 rounded-xl border p-3 text-sm">
                                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                                    Note from {request.approver?.name}
                                </div>
                                {request.decision_note}
                            </div>
                        )}
                    </Card>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <SignatureCard heading="Requested by" signer={request.requester} />
                        {request.approver ? (
                            <SignatureCard
                                heading={request.status === 'rejected' ? 'Rejected by' : 'Approved by'}
                                signer={request.approver}
                                rejected={request.status === 'rejected'}
                            />
                        ) : (
                            <div className="flex flex-col justify-center rounded-2xl border border-dashed p-5 text-sm">
                                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Approved by</div>
                                <div className="text-muted-foreground mt-3">
                                    {request.status === 'cancelled'
                                        ? 'Withdrawn before approval.'
                                        : approvers.length > 0
                                          ? `Waiting for ${approvers.join(', ')} at ${request.from.company}.`
                                          : `Waiting for a manager at ${request.from.company}.`}
                                </div>
                            </div>
                        )}
                    </div>

                    {request.can_decide && (
                        <ApprovePanel request={request} savedSignatureUrl={savedSignatureUrl} onReject={() => setRejectOpen(true)} />
                    )}
                    {request.can_execute && <TransferPanel request={request} />}
                </div>

                <Card title="History">
                    <ol className="relative space-y-5 border-l pl-6">
                        <Step icon={<Send className="size-3.5" />} tone="bg-primary" title="Requested" when={request.requester.at}>
                            {request.requester.name}
                        </Step>
                        {request.approver && (
                            <Step
                                icon={request.status === 'rejected' ? <XCircle className="size-3.5" /> : <PenLine className="size-3.5" />}
                                tone={request.status === 'rejected' ? 'bg-rose-500' : 'bg-blue-500'}
                                title={request.status === 'rejected' ? 'Rejected' : 'Approved and signed'}
                                when={request.approver.at}
                            >
                                {request.approver.name}
                            </Step>
                        )}
                        {request.transferred_at && (
                            <Step icon={<Banknote className="size-3.5" />} tone="bg-emerald-500" title="Transferred" when={request.transferred_at}>
                                {request.transferred_by} · value date {shortDate(request.transfer_date)}
                                {request.transfer_reference ? ` · ref ${request.transfer_reference}` : ''}
                            </Step>
                        )}
                        {request.cancelled_at && (
                            <Step icon={<Ban className="size-3.5" />} tone="bg-slate-400" title="Withdrawn" when={request.cancelled_at}>
                                {request.requester.name}
                            </Step>
                        )}
                        {request.status === 'pending' && (
                            <Step icon={<Clock className="size-3.5" />} tone="bg-amber-500" title="Awaiting approval" when={null}>
                                {request.from.company}
                            </Step>
                        )}
                        {request.status === 'approved' && (
                            <Step icon={<Clock className="size-3.5" />} tone="bg-amber-500" title="Awaiting transfer" when={null}>
                                Ready to transfer to {request.to.company}
                            </Step>
                        )}
                    </ol>
                </Card>
            </div>

            <RejectDialog open={rejectOpen} onClose={() => setRejectOpen(false)} request={request} />
        </Page>
    );
}

function Party({ label, company, account, bank }: { label: string; company: string; account: string; bank: string }) {
    return (
        <div className="bg-background/70 rounded-xl border p-4">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
            <div className="mt-1 text-lg font-semibold">{company}</div>
            <div className="text-muted-foreground text-sm tabular-nums">
                {bank} · {account}
            </div>
        </div>
    );
}

function SignatureCard({ heading, signer, rejected = false }: { heading: string; signer: Signer; rejected?: boolean }) {
    return (
        <div className="bg-card/70 rounded-2xl border p-5">
            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{heading}</div>
            <div className="mt-3 flex h-20 items-center rounded-xl bg-white px-3">
                {rejected ? (
                    <span className="text-lg font-bold tracking-widest text-rose-600">REJECTED</span>
                ) : signer.signature_url ? (
                    <img src={signer.signature_url} alt={`Signature of ${signer.name}`} className="max-h-16 max-w-full object-contain" />
                ) : (
                    <span className="text-sm text-slate-400">No signature</span>
                )}
            </div>
            <div className="mt-3 border-t pt-3">
                <div className="font-semibold">{signer.name}</div>
                {signer.title && <div className="text-muted-foreground text-sm">{signer.title}</div>}
                <div className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
                    <Clock className="size-3" /> {stamp(signer.at)}
                </div>
            </div>
        </div>
    );
}

function Step({ icon, tone, title, when, children }: { icon: ReactNode; tone: string; title: string; when: string | null; children: ReactNode }) {
    return (
        <li>
            <span
                className={`absolute -left-3 flex size-6 items-center justify-center rounded-full text-white ring-4 ring-[var(--background)] ${tone}`}
            >
                {icon}
            </span>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-muted-foreground text-xs">{children}</div>
            {when && <div className="text-muted-foreground text-xs">{stamp(when)}</div>}
        </li>
    );
}

function ApprovePanel({ request, savedSignatureUrl, onReject }: { request: Detail; savedSignatureUrl: string | null; onReject: () => void }) {
    const form = useForm({ signature: null as string | null, note: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.fund-requests.approve', request.id), { preserveScroll: true });
    };

    return (
        <form
            onSubmit={submit}
            className="space-y-4 rounded-2xl border-2 border-amber-300/80 bg-amber-50/60 p-5 dark:border-amber-500/40 dark:bg-amber-500/5"
        >
            <div>
                <h2 className="text-lg font-semibold">Your approval is needed</h2>
                <p className="text-muted-foreground text-sm">
                    Approving fixes your name, signature and the time to this request, and tells {request.requester.name} the transfer can go ahead.
                </p>
            </div>
            <div className="grid gap-1.5 text-sm">
                <span className="font-medium">Your signature</span>
                <SignaturePad savedSignatureUrl={savedSignatureUrl} onChange={(v) => form.setData('signature', v)} error={form.errors.signature} />
            </div>
            <Field label="Note (optional)" error={form.errors.note}>
                <TextArea value={form.data.note} onChange={(v) => form.setData('note', v)} rows={2} />
            </Field>
            <div className="flex flex-wrap gap-2">
                <button type="submit" className={primaryButton} disabled={form.processing || (!form.data.signature && !savedSignatureUrl)}>
                    <CheckCircle2 className="mr-1.5 size-4" /> Approve and sign
                </button>
                <button type="button" className={dangerButton} onClick={onReject} disabled={form.processing}>
                    <XCircle className="mr-1.5 size-4" /> Reject
                </button>
            </div>
        </form>
    );
}

function TransferPanel({ request }: { request: Detail }) {
    const form = useForm({ transfer_date: new Date().toISOString().slice(0, 10), reference: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.fund-requests.transfer', request.id), { preserveScroll: true });
    };

    return (
        <form
            onSubmit={submit}
            className="space-y-4 rounded-2xl border-2 border-emerald-300/80 bg-emerald-50/60 p-5 dark:border-emerald-500/40 dark:bg-emerald-500/5"
        >
            <div>
                <h2 className="text-lg font-semibold">Approved: make the transfer</h2>
                <p className="text-muted-foreground text-sm">
                    {request.currency} {money(request.amount)} is debited from {request.from.company} ({request.from.account}) and credited to{' '}
                    {request.to.company} ({request.to.account}).
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Value date" error={form.errors.transfer_date}>
                    <TextInput type="date" value={form.data.transfer_date} onChange={(v) => form.setData('transfer_date', v)} required />
                </Field>
                <Field label="Bank reference (optional)" error={form.errors.reference}>
                    <TextInput value={form.data.reference} onChange={(v) => form.setData('reference', v)} placeholder={request.reference} />
                </Field>
            </div>
            {(form.errors as Record<string, string>).request && (
                <p className="text-destructive text-sm">{(form.errors as Record<string, string>).request}</p>
            )}
            <button type="submit" className={primaryButton} disabled={form.processing}>
                <Banknote className="mr-1.5 size-4" /> Transfer {request.currency} {money(request.amount)}
            </button>
        </form>
    );
}

function RejectDialog({ open, onClose, request }: { open: boolean; onClose: () => void; request: Detail }) {
    const form = useForm({ note: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('erp.banking.fund-requests.reject', request.id), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open={open} onOpenChange={(value) => !value && !form.processing && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Reject {request.reference}</DialogTitle>
                        <DialogDescription>
                            {request.requester.name} is told, with your reason. The money cannot be moved on this request.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Reason" error={form.errors.note}>
                        <TextArea value={form.data.note} onChange={(v) => form.setData('note', v)} rows={3} />
                    </Field>
                    <DialogFooter className="gap-2">
                        <button type="button" className={secondaryButton} onClick={onClose} disabled={form.processing}>
                            Cancel
                        </button>
                        <button type="submit" className={dangerButton} disabled={form.processing || !form.data.note.trim()}>
                            Reject request
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
