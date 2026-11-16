<?php

namespace App\Modules\Accounting\Listeners;

use App\Modules\Accounting\Services\AccountingPostingService;
use App\Modules\Accounting\Services\LedgerAccountResolver;
use App\Modules\Core\Services\AuditLogService;
use App\Modules\Core\Services\CompanyContext;
use App\Modules\Invoicing\Events\InvoicePaymentRecorded;

/**
 * Posts a customer payment to the general ledger:
 *   Dr Cash/Bank (clearing account for the payment method)
 *   Cr Accounts receivable
 *
 * Credit-note allocations (payment_method = credit_note) move no cash, so they are
 * skipped here — the credit note itself already posted its receivable entry when issued.
 */
class PostInvoicePaymentToLedger
{
    public function __construct(
        private AccountingPostingService $postingService,
        private LedgerAccountResolver $resolver,
    ) {}

    public function handle(InvoicePaymentRecorded $event): void
    {
        $payment = $event->payment->fresh(['invoice.customer']);
        if ($payment === null || $payment->credit_note_id !== null) {
            return;
        }

        $invoice = $payment->invoice;
        $company = app(CompanyContext::class)->requireActiveCompany();

        $journal = $this->resolver->paymentJournal($company, $payment->payment_method);
        $clearing = $this->resolver->clearingAccount($company, $payment->payment_method);
        $receivable = $this->resolver->receivableAccount($company);

        $entry = $this->postingService->postSourceEntry($event->actor, $payment, [
            'journal_id' => $journal->id,
            'entry_date' => $payment->payment_date,
            'currency_code' => $payment->currency_code,
            'description' => 'Payment for '.$invoice->document_number.' - '.$invoice->customer->name,
            'reference' => $payment->reference ?? $invoice->document_number,
        ], [
            [
                'account_id' => $clearing->id,
                'description' => 'Payment '.$invoice->document_number.($payment->payment_method ? ' via '.$payment->payment_method : ''),
                'debit' => (string) $payment->amount,
                'credit' => '0.0000',
            ],
            [
                'account_id' => $receivable->id,
                'description' => 'Settlement of '.$invoice->document_number,
                'debit' => '0.0000',
                'credit' => (string) $payment->amount,
            ],
        ]);

        app(AuditLogService::class)->record(
            $company,
            'invoicing.payment.posted_to_ledger',
            $payment,
            changes: ['after' => [
                'invoice_number' => $invoice->document_number,
                'amount' => (string) $payment->amount,
                'currency_code' => $payment->currency_code,
                'journal_entry_id' => $entry->id,
                'journal_entry_number' => $entry->document_number,
            ]],
            actor: $event->actor,
        );
    }
}
